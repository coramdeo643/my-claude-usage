import * as vscode from 'vscode';
import { readCredential } from './credential_reader';
import { fetchUsage } from './usage_api';
import { readCache, writeCache } from './shared_cache';
import { SharedCache, UsageSnapshot } from '../shared/types';

/** 다른 창의 요청이 끝나기를 기다려주는 최대 시간 (요청 타임아웃 10초 + 여유) */
const IN_FLIGHT_TTL_MS = 15_000;
/** Retry-After 헤더가 없을 때 쓰는 429 백오프 기본값과 상한 */
const BACKOFF_BASE_MS = 60_000;
const BACKOFF_MAX_MS = 15 * 60_000;
/** 마지막 성공값을 계속 보여줄 수 있는 한계. 넘으면 수치 대신 에러를 표시합니다. */
const STALE_MAX_MS = 30 * 60_000;
/** 여러 창이 동시에 켜질 때 첫 요청이 겹치지 않도록 흩뿌리는 폭 */
const STARTUP_JITTER_MS = 3_000;

export class Reactor {
  private timer?: NodeJS.Timeout;
  private firstSyncTimer?: NodeJS.Timeout;
  private intervalMs = 120_000;
  private emitter = new vscode.EventEmitter<UsageSnapshot>();
  public readonly onSnapshot = this.emitter.event;

  async start(intervalMs: number): Promise<void> {
    this.intervalMs = intervalMs;

    // 다른 창이 이미 받아둔 값이 있으면 네트워크 없이 즉시 표시
    const cache = readCache();
    if (cache.snapshot) {
      this.emitFromCache(cache, Date.now());
    }

    this.firstSyncTimer = setTimeout(() => this.sync(), Math.random() * STARTUP_JITTER_MS);
    this.timer = setInterval(() => this.sync(), intervalMs);
  }

  /** force는 신선도 검사만 건너뜁니다. 429 쿨다운은 수동 새로고침으로도 뚫지 않습니다. */
  async sync(force = false): Promise<void> {
    const now = Date.now();
    const cache = readCache();

    // 1. 다른 창이 방금 받아온 값이 아직 신선하면 요청하지 않습니다.
    if (!force && cache.snapshot && now - cache.fetchedAt < this.freshnessMs()) {
      this.emitFromCache(cache, now);
      return;
    }

    // 2. 다른 창이 요청 중이면 그 결과가 캐시에 들어올 때까지 기다립니다.
    if (now < cache.inFlightUntil) {
      this.emitFromCache(cache, now);
      return;
    }

    // 3. 429 백오프 중에는 요청 자체를 보내지 않습니다.
    if (now < cache.cooldownUntil) {
      this.emitFromCache(cache, now);
      return;
    }

    const token = await readCredential();
    if (!token) {
      this.emitter.fire({
        session: null,
        weekly: null,
        fetchedAt: now,
        isConnected: false,
        errorKind: 'no_auth',
        errorMessage: 'No auth (Claude Code)',
      });
      return;
    }

    // 다른 창이 같은 구간에 중복 요청하지 않도록 선점
    writeCache({ inFlightUntil: now + IN_FLIGHT_TTL_MS });

    const snapshot = await fetchUsage(token);

    if (snapshot.isConnected) {
      writeCache({
        snapshot,
        fetchedAt: snapshot.fetchedAt,
        inFlightUntil: 0,
        cooldownUntil: 0,
        throttleStreak: 0,
      });
      this.emitter.fire(snapshot);
      return;
    }

    if (snapshot.errorKind === 'rate_limited') {
      const streak = cache.throttleStreak + 1;
      // 서버가 retry-after: 0 을 보내는 경우가 있어 힌트를 그대로 믿으면 백오프가 사라집니다.
      // 자체 백오프를 하한으로 두고, 서버가 더 길게 요구하면 그쪽을 따릅니다.
      const backoffMs = Math.max(snapshot.retryAfterMs ?? 0, this.backoffFor(streak));
      const cooldownUntil = Date.now() + backoffMs;

      writeCache({ inFlightUntil: 0, cooldownUntil, throttleStreak: streak });
      this.emitter.fire(this.keepLastGood(cache, { ...snapshot, retryAt: cooldownUntil }));
      return;
    }

    writeCache({ inFlightUntil: 0 });
    this.emitter.fire(this.keepLastGood(cache, snapshot));
  }

  shutdown(): void {
    if (this.firstSyncTimer) {
      clearTimeout(this.firstSyncTimer);
      this.firstSyncTimer = undefined;
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.emitter.dispose();
  }

  /** 이 시간 안에 받아온 값이면 재요청하지 않습니다. */
  private freshnessMs(): number {
    return Math.max(this.intervalMs * 0.9, 30_000);
  }

  private backoffFor(streak: number): number {
    return Math.min(BACKOFF_BASE_MS * Math.pow(2, streak - 1), BACKOFF_MAX_MS);
  }

  /**
   * 실패해도 최근 성공값이 있으면 그 수치를 유지합니다.
   * 순간적인 429/네트워크 오류로 상태바가 비어버리는 것을 막습니다.
   */
  private keepLastGood(cache: SharedCache, failure: UsageSnapshot): UsageSnapshot {
    if (!cache.snapshot || Date.now() - cache.fetchedAt > STALE_MAX_MS) {
      return failure;
    }
    return {
      ...cache.snapshot,
      isStale: true,
      errorKind: failure.errorKind,
      errorMessage: failure.errorMessage,
      retryAt: failure.retryAt,
    };
  }

  private emitFromCache(cache: SharedCache, now: number): void {
    const isThrottled = now < cache.cooldownUntil;

    if (!cache.snapshot || now - cache.fetchedAt > STALE_MAX_MS) {
      this.emitter.fire({
        session: null,
        weekly: null,
        fetchedAt: now,
        isConnected: false,
        errorKind: isThrottled ? 'rate_limited' : 'pending',
        errorMessage: isThrottled ? 'Rate limited' : 'Waiting for another window',
        retryAt: isThrottled ? cache.cooldownUntil : undefined,
      });
      return;
    }

    this.emitter.fire({
      ...cache.snapshot,
      isStale: now - cache.fetchedAt > this.freshnessMs(),
      errorKind: isThrottled ? 'rate_limited' : undefined,
      errorMessage: isThrottled ? 'Rate limited' : undefined,
      retryAt: isThrottled ? cache.cooldownUntil : undefined,
    });
  }
}
