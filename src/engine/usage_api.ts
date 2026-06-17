import * as https from 'https';
import { OAuthToken, UsageSnapshot, RateLimitWindow } from '../shared/types';

interface HttpsResult {
  statusCode: number;
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

    // 2. Legacy endpoint 폴백
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

    return {
      session: null,
      weekly: null,
      fetchedAt: Date.now(),
      isConnected: false,
      errorMessage: `API failed with status ${response.statusCode}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      session: null,
      weekly: null,
      fetchedAt: Date.now(),
      isConnected: false,
      errorMessage: msg,
    };
  }
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
      errorMessage: 'Failed to parse JSON response',
    };
  }
}
