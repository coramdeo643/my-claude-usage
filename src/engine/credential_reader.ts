import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { OAuthToken } from '../shared/types';

const execFileAsync = promisify(execFile);

// Claude Code OAuth 저장소에서 사용하는 키 변형
const OAUTH_SUFFIXES = ['', '-custom-oauth', '-local-oauth'];

/**
 * Claude Code의 OAuth 토큰을 OS 환경에서 읽어옵니다.
 * 저장 위치는 OS마다 다릅니다:
 * 1. ~/.claude/.credentials.json  (Windows / Linux 평문 파일)
 * 2. macOS Keychain               (service "Claude Code-credentials", account=사용자명)
 * 3. ANTHROPIC_API_KEY 환경변수    (CI / 컨테이너 폴백)
 */
export async function readCredential(): Promise<OAuthToken | null> {
  // 1. JSON 파일 시도 (Windows / Linux 기본 저장 위치)
  const credPath = path.join(getConfigDir(), '.credentials.json');
  if (fs.existsSync(credPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
      const token = parseOauthStore(raw);
      if (token) {
        return token;
      }
    } catch (e) {
      console.error('Failed to parse .credentials.json', e);
    }
  }

  // 2. macOS Keychain 시도 (macOS 기본 저장 위치)
  if (process.platform === 'darwin') {
    for (const service of getKeychainServiceCandidates()) {
      for (const account of getKeychainAccountCandidates()) {
        try {
          const { stdout } = await execFileAsync('security', [
            'find-generic-password', '-s', service, '-a', account, '-w',
          ]);
          // 값은 raw 토큰이 아니라 claudeAiOauth를 담은 JSON 블롭입니다.
          const raw = JSON.parse(stdout.trim());
          const token = parseOauthStore(raw);
          if (token) {
            return token;
          }
        } catch (e) {
          // 해당 service/account 조합에 없으면 다음 후보로
        }
      }
    }
  }

  // 3. 환경변수 폴백
  const envKey = process.env['ANTHROPIC_API_KEY'];
  if (envKey) {
    return { accessToken: envKey, refreshToken: null, expiresAt: null };
  }

  return null;
}

/** claudeAiOauth(+변형) 객체에서 토큰을 추출합니다. 파일/키체인 공통. */
function parseOauthStore(raw: any): OAuthToken | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  for (const suffix of OAUTH_SUFFIXES) {
    const entry = raw[`claudeAiOauth${suffix}`];
    if (entry && entry.accessToken) {
      return {
        accessToken: entry.accessToken,
        refreshToken: entry.refreshToken ?? null,
        expiresAt: entry.expiresAt ?? null,
      };
    }
  }
  return null;
}

/** Claude config 디렉터리. CLAUDE_CONFIG_DIR 환경변수를 우선합니다. */
function getConfigDir(): string {
  return process.env['CLAUDE_CONFIG_DIR'] ?? path.join(os.homedir(), '.claude');
}

/**
 * Keychain service 이름 후보.
 * Claude Code 버전에 따라 config 디렉터리 해시가 접미사로 붙기도 합니다.
 * 예: "Claude Code-credentials", "Claude Code-credentials-da8729d2"
 */
function getKeychainServiceCandidates(): string[] {
  const hash = crypto.createHash('sha256').update(getConfigDir()).digest('hex').slice(0, 8);
  const candidates = new Set<string>();
  for (const suffix of OAUTH_SUFFIXES) {
    candidates.add(`Claude Code${suffix}-credentials`);
    candidates.add(`Claude Code${suffix}-credentials-${hash}`);
  }
  return Array.from(candidates);
}

/** Keychain account 이름 후보. 보통 OS 사용자명입니다. */
function getKeychainAccountCandidates(): string[] {
  const candidates = new Set<string>();
  try {
    candidates.add(os.userInfo().username);
  } catch {
    // 무시
  }
  if (process.env['USER']) {
    candidates.add(process.env['USER'] as string);
  }
  candidates.add('claude-code-user');
  return Array.from(candidates);
}
