import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SharedCache } from '../shared/types';

const CACHE_FILE = path.join(os.tmpdir(), 'my-claude-usage-cache.json');

const EMPTY: SharedCache = {
  snapshot: null,
  fetchedAt: 0,
  inFlightUntil: 0,
  cooldownUntil: 0,
  throttleStreak: 0,
};

/** 공유 캐시를 읽습니다. 파일이 없거나 깨졌으면 빈 캐시로 취급합니다. */
export function readCache(): SharedCache {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    return { ...EMPTY, ...raw };
  } catch {
    return { ...EMPTY };
  }
}

/**
 * 전달한 필드만 갱신합니다.
 * 다른 창이 읽는 도중 반쯤 쓰인 파일을 보지 않도록 임시 파일에 쓴 뒤 rename 합니다.
 */
export function writeCache(patch: Partial<SharedCache>): SharedCache {
  const next: SharedCache = { ...readCache(), ...patch };
  const tmpPath = `${CACHE_FILE}.${process.pid}.tmp`;

  try {
    fs.writeFileSync(tmpPath, JSON.stringify(next), 'utf-8');
    fs.renameSync(tmpPath, CACHE_FILE);
  } catch (e) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // 임시 파일이 안 만들어졌으면 지울 것도 없음
    }
    console.error('[my-claude-usage] cache write failed', e);
  }

  return next;
}
