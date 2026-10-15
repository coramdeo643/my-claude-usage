/** 5시간/주간 쿼타 윈도우 */
export interface RateLimitWindow {
  percent: number;       // 0~100 사용량 퍼센트
  resetAt: number;       // 리셋 시각 (epoch ms)
  used?: number;         // 사용된 양 (raw)
  limit?: number;        // 한도 (raw)
}

/**
 * 실패 원인 구분. 상태바 문구가 원인과 맞아떨어지도록 하기 위한 값입니다.
 * pending은 다른 창이 요청 중이라 아직 값이 없는 정상 대기 상태입니다.
 */
export type ErrorKind = 'no_auth' | 'rate_limited' | 'http' | 'network' | 'parse' | 'pending';

/** Reactor가 발행하는 스냅샷 */
export interface UsageSnapshot {
  session: RateLimitWindow | null;  // 5시간 윈도우
  weekly: RateLimitWindow | null;   // 주간 윈도우
  fetchedAt: number;                // 수집 시각
  isConnected: boolean;             // 표시할 수치가 있는지 여부
  errorKind?: ErrorKind;
  errorMessage?: string;
  retryAfterMs?: number;            // 429 응답의 Retry-After (헤더가 있을 때만)
  retryAt?: number;                 // 다음 요청 가능 시각 (epoch ms)
  isStale?: boolean;                // 캐시에서 복원한 값이면 true
}

/** credential 읽기 결과 */
export interface OAuthToken {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

/**
 * VS Code 창마다 확장 호스트 프로세스가 분리되므로, 창 간 폴링 중복을 막으려면
 * 프로세스 밖에 상태를 둬야 합니다. 이 구조체가 그 공유 상태입니다.
 */
export interface SharedCache {
  snapshot: UsageSnapshot | null;  // 마지막 성공 스냅샷
  fetchedAt: number;               // 마지막 성공 시각
  inFlightUntil: number;           // 다른 창이 요청 중임을 알리는 선점 만료 시각
  cooldownUntil: number;           // 429 백오프 해제 시각
  throttleStreak: number;          // 연속 429 횟수 (지수 백오프용)
}
