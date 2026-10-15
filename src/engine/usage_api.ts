import * as https from 'https';
import { IncomingHttpHeaders } from 'http';
import { OAuthToken, UsageSnapshot, RateLimitWindow } from '../shared/types';

/** legacy endpoint 재시도가 의미 있는 상태코드. 429/401은 재요청해도 악화만 됩니다. */
const FALLBACK_STATUSES = new Set([404, 405, 501]);

interface HttpsResult {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: string;
}

function httpsRequest(opts: https.RequestOptions, postData?: string): Promise<HttpsResult> {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', (e) => reject(e));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

export async function fetchUsage(token: OAuthToken): Promise<UsageSnapshot> {
  try {
    // 1. OAuth usage endpoint 시도
    const response = await httpsRequest({
      hostname: 'api.anthropic.com',
      path: '/api/oauth/usage',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'Content-Type': 'application/json',
        'User-Agent': 'my-claude-usage/0.0.1',
      },
      timeout: 10000,
    });

    if (response.statusCode === 200) {
      return parseUsageResponse(response.body);
    }

    // 2. endpoint 자체가 없을 때만 legacy로 폴백
    if (FALLBACK_STATUSES.has(response.statusCode)) {
      const legacyResponse = await httpsRequest({
        hostname: 'api.anthropic.com',
        path: '/api/usage',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'User-Agent': 'my-claude-usage/0.0.1',
        },
        timeout: 10000,
      });

      if (legacyResponse.statusCode === 200) {
        return parseUsageResponse(legacyResponse.body);
      }

      return httpErrorSnapshot(legacyResponse);
    }

    return httpErrorSnapshot(response);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      session: null,
      weekly: null,
      fetchedAt: Date.now(),
      isConnected: false,
      errorKind: 'network',
      errorMessage: msg,
    };
  }
}

function httpErrorSnapshot(res: HttpsResult): UsageSnapshot {
  const isThrottled = res.statusCode === 429;
  return {
    session: null,
    weekly: null,
    fetchedAt: Date.now(),
    isConnected: false,
    errorKind: isThrottled ? 'rate_limited' : 'http',
    errorMessage: `API failed with status ${res.statusCode}`,
    retryAfterMs: isThrottled ? parseRetryAfter(res.headers) : undefined,
  };
}

/** Retry-After는 초 단위 숫자 또는 HTTP-date 둘 다 올 수 있습니다. */
function parseRetryAfter(headers: IncomingHttpHeaders): number | undefined {
  const raw = headers['retry-after'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds) * 1000;
  }

  const dateMs = new Date(value).getTime();
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return undefined;
}

function parseUsageResponse(bodyStr: string): UsageSnapshot {
  try {
    const data = JSON.parse(bodyStr);

    // API 응답에서 limits 배열 추출 (없으면 빈 배열)
    const limits: any[] = data.limits || [];

    let session: RateLimitWindow | null = null;
    let weekly: RateLimitWindow | null = null;

    for (const limit of limits) {
      const isSession = limit.group === 'session' || limit.kind === 'session';
      const isWeekly = limit.group === 'weekly' || limit.kind === 'weekly_all';

      if (!isSession && !isWeekly) continue;

      const resetAtStr = limit.resets_at;
      const resetAt = resetAtStr ? new Date(resetAtStr).getTime() : 0;

      // API가 반환하는 percent는 "사용량(utilization)"입니다. 그대로 사용량으로 저장합니다.
      const percent = Math.min(100, Math.max(0, limit.percent ?? 0));

      const windowData: RateLimitWindow = {
        percent,
        resetAt,
      };

      if (isSession) session = windowData;
      else if (isWeekly) weekly = windowData;
    }

    return {
      session,
      weekly,
      fetchedAt: Date.now(),
      isConnected: true,
    };
  } catch (e) {
    return {
      session: null,
      weekly: null,
      fetchedAt: Date.now(),
      isConnected: false,
      errorKind: 'parse',
      errorMessage: 'Failed to parse JSON response',
    };
  }
}
