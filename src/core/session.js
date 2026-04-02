import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = resolve(__dirname, '../../sessions');

export function sessionPath(platform) {
  if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true });
  return resolve(SESSIONS_DIR, `${platform}.json`);
}

export function hasSession(platform) {
  return existsSync(sessionPath(platform));
}

export async function saveSession(platform, context) {
  const state = await context.storageState();
  writeFileSync(sessionPath(platform), JSON.stringify(state, null, 2), 'utf-8');
  console.log(`[session] ${platform} 세션 저장 완료`);
}
