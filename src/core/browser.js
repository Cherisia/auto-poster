import { chromium } from 'playwright';

/**
 * 실행 중인 크롬에 CDP로 연결
 * start-chrome.bat 으로 크롬을 먼저 실행해야 합니다
 */
export async function connectBrowser() {
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    return browser;
  } catch {
    throw new Error(
      'start-chrome.bat 을 먼저 실행하고 티스토리 로그인 후 다시 시도하세요.'
    );
  }
}

/**
 * 연결된 브라우저에서 새 페이지 생성
 */
export async function newPage(browser) {
  const contexts = browser.contexts();
  const context = contexts[0];
  return context.newPage();
}
