/** 5시간/주간 쿼타 윈도우 */
export interface RateLimitWindow {
  percent: number;       // 0~100 사용량 퍼센트
  resetAt: number;       // 리셋 시각 (epoch ms)
  used?: number;         // 사용된 양 (raw)
  limit?: number;        // 한도 (raw)
}

/** Reactor가 발행하는 스냅샷 */
export interface UsageSnapshot {
  session: RateLimitWindow | null;  // 5시간 윈도우
  weekly: RateLimitWindow | null;   // 주간 윈도우
  fetchedAt: number;                // 수집 시각
  isConnected: boolean;
  errorMessage?: string;
}

/** credential 읽기 결과 */
export interface OAuthToken {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}
