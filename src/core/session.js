import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = resolve(__dirname, '../../sessions');

function ensureSessionsDir() {
  if (!existsSync(SESSIONS_DIR)) {
    mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

function sessionPath(platform) {
  return resolve(SESSIONS_DIR, `${platform}.json`);
}

/**
 * 세션(쿠키+로컬스토리지) 저장
 */
export async function saveSession(platform, context) {
  ensureSessionsDir();
  const state = await context.storageState();
  writeFileSync(sessionPath(platform), JSON.stringify(state, null, 2), 'utf-8');
  console.log(`[session] ${platform} 세션 저장 완료`);
}

/**
 * 저장된 세션 불러오기. 없으면 null 반환.
 */
export function loadSession(platform) {
  const path = sessionPath(platform);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

/**
 * 세션 파일 삭제 (로그아웃 / 세션 만료 시)
 */
export function clearSession(platform) {
  const path = sessionPath(platform);
  if (existsSync(path)) {
    unlinkSync(path);
    console.log(`[session] ${platform} 세션 삭제됨`);
  }
}
