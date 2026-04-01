import { newContext } from '../core/browser.js';
import { saveSession, loadSession } from '../core/session.js';

const LOGIN_URL = 'https://nid.naver.com/nidlogin.login';

/**
 * 네이버 로그인 후 세션 저장.
 * 봇 감지로 인해 브라우저만 열고 로그인은 사용자가 직접 진행.
 */
export async function naverLogin(force = false) {
  const existing = loadSession('naver');

  if (existing && !force) {
    console.log('[naver] 저장된 세션 사용');
    return existing;
  }

  console.log('[naver] 로그인 브라우저 열기...');

  const context = await newContext();
  const page = await context.newPage();

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  console.log('');
  console.log('──────────────────────────────────────');
  console.log('  브라우저에서 직접 로그인해주세요:');
  console.log('  1. 아이디 / 비밀번호 입력');
  console.log('  2. 캡차가 있으면 해결');
  console.log('  3. 로그인 버튼 클릭');
  console.log('  4. 네이버 메인이 뜨면 여기서 Enter');
  console.log('──────────────────────────────────────');

  await waitForUserInput();
  console.log('[naver] 로그인 완료 확인됨');

  await saveSession('naver', context);
  await context.close();

  return loadSession('naver');
}

/**
 * 세션 유효성 확인
 */
export async function checkNaverSession() {
  const session = loadSession('naver');
  if (!session) return false;

  const context = await newContext(session);
  const page = await context.newPage();

  await page.goto('https://www.naver.com', { waitUntil: 'domcontentloaded' });

  const isLoggedIn = await page.locator('.MyView-module__btn_my___HoPUH').isVisible()
    .catch(() => false);

  await context.close();

  if (isLoggedIn) {
    console.log('[naver] 세션 유효');
  } else {
    console.log('[naver] 세션 만료 — 재로그인 필요');
  }

  return isLoggedIn;
}

function waitForUserInput() {
  return new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
}
