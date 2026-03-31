import 'dotenv/config';
import { newContext } from '../core/browser.js';
import { saveSession, loadSession } from '../core/session.js';

const KAKAO_LOGIN_URL = 'https://www.tistory.com/auth/kakao';
const TISTORY_MAIN_URL = 'https://www.tistory.com';

/**
 * 티스토리 (카카오 계정) 로그인 후 세션 저장.
 */
export async function tistoryLogin(force = false) {
  const existing = loadSession('tistory');

  if (existing && !force) {
    console.log('[tistory] 저장된 세션 사용');
    return existing;
  }

  console.log('[tistory] 카카오 로그인 시작...');

  const context = await newContext();
  const page = await context.newPage();

  await page.goto(KAKAO_LOGIN_URL, { waitUntil: 'domcontentloaded' });

  // 카카오 로그인 폼 대기
  await page.waitForSelector('#loginId--1', { timeout: 10000 });

  await page.fill('#loginId--1', process.env.KAKAO_EMAIL);
  await page.fill('#password--2', process.env.KAKAO_PW);
  await page.click('.submit');

  // 로그인 후 티스토리 메인으로 리다이렉트 대기
  try {
    await page.waitForURL(`${TISTORY_MAIN_URL}/**`, { timeout: 15000 });
    console.log('[tistory] 로그인 성공');
  } catch {
    console.log('[tistory] 추가 인증이 필요합니다. 브라우저에서 직접 완료 후 Enter를 눌러주세요.');
    await waitForUserInput();
  }

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
