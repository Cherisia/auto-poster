import 'dotenv/config';
import { newContext } from '../core/browser.js';
import { saveSession, loadSession } from '../core/session.js';

const TISTORY_MAIN_URL = 'https://www.tistory.com';

/**
 * 티스토리 (카카오 계정) 로그인 후 세션 저장.
 * 카카오가 봇 감지를 하므로 브라우저만 열고 로그인은 사용자가 직접 진행.
 */
export async function tistoryLogin(force = false) {
  const existing = loadSession('tistory');

  if (existing && !force) {
    console.log('[tistory] 저장된 세션 사용');
    return existing;
  }

  console.log('[tistory] 로그인 브라우저 열기...');

  const context = await newContext();
  const page = await context.newPage();

  // 티스토리 로그인 페이지 오픈
  await page.goto('https://www.tistory.com/auth/login', { waitUntil: 'domcontentloaded' });

  // 로그인 전체를 사용자가 직접 진행 (카카오 봇 감지 우회)
  console.log('');
  console.log('──────────────────────────────────────');
  console.log('  브라우저에서 직접 로그인해주세요:');
  console.log('  1. 카카오계정으로 로그인 버튼 클릭');
  console.log('  2. 이메일 / 비밀번호 입력');
  console.log('  3. 브라우저 인증 등 추가 인증 완료');
  console.log('  4. 티스토리 메인이 뜨면 여기서 Enter');
  console.log('──────────────────────────────────────');

  await waitForUserInput();
  console.log('[tistory] 로그인 완료 확인됨');

  await saveSession('tistory', context);
  await context.close();

  return loadSession('tistory');
}

/**
 * 세션 유효성 확인
 */
export async function checkTistorySession() {
  const session = loadSession('tistory');
  if (!session) return false;

  const context = await newContext(session);
  const page = await context.newPage();

  await page.goto(TISTORY_MAIN_URL, { waitUntil: 'domcontentloaded' });

  // 로그인 상태: 프로필/마이페이지 버튼 존재
  const isLoggedIn = await page.locator('a[href*="/manage"]').first().isVisible()
    .catch(() => false);

  await context.close();

  if (isLoggedIn) {
    console.log('[tistory] 세션 유효');
  } else {
    console.log('[tistory] 세션 만료 — 재로그인 필요');
  }

  return isLoggedIn;
}

function waitForUserInput() {
  return new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
}
