import 'dotenv/config';
import { newContext } from '../core/browser.js';
import { saveSession, loadSession } from '../core/session.js';

const LOGIN_URL = 'https://nid.naver.com/nidlogin.login';
const BLOG_WRITE_URL = 'https://blog.naver.com/gongnong';

/**
 * 네이버 로그인 후 세션 저장.
 * 이미 유효한 세션이 있으면 스킵.
 */
export async function naverLogin(force = false) {
  const existing = loadSession('naver');

  if (existing && !force) {
    console.log('[naver] 저장된 세션 사용');
    return existing;
  }

  console.log('[naver] 로그인 시작...');

  const context = await newContext();
  const page = await context.newPage();

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  // ID/PW 입력 — 네이버는 JS 키보드 이벤트 기반이므로 type 사용
  await page.fill('#id', process.env.NAVER_ID);
  await page.fill('#pw', process.env.NAVER_PW);
  await page.click('.btn_login');

  // 로그인 성공 여부 확인: 메인 페이지로 리다이렉트 대기
  try {
    await page.waitForURL('https://www.naver.com/**', { timeout: 10000 });
    console.log('[naver] 로그인 성공');
  } catch {
    // 2차 인증(캡차, 기기 등록 등) 필요 시 사용자가 수동으로 처리
    console.log('[naver] 추가 인증이 필요합니다. 브라우저에서 직접 완료 후 Enter를 눌러주세요.');
    await waitForUserInput();
  }

  await saveSession('naver', context);
  await context.close();

  return loadSession('naver');
}

/**
 * 세션 유효성 확인 — 블로그 접근이 되는지 체크
 */
export async function checkNaverSession() {
  const session = loadSession('naver');
  if (!session) return false;

  const context = await newContext(session);
  const page = await context.newPage();

  await page.goto('https://www.naver.com', { waitUntil: 'domcontentloaded' });

  // 로그인 상태: 상단에 사용자 정보가 있음
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
