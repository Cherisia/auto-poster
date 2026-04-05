import { chromium } from 'playwright';

const CDP_URL = 'http://localhost:9222';

/**
 * 실행 중인 크롬에 CDP로 연결
 * start-chrome.bat 으로 크롬을 먼저 실행해야 합니다
 */
export async function connectBrowser() {
  try {
    return await chromium.connectOverCDP(CDP_URL);
  } catch {
    throw new Error('start-chrome.bat 을 먼저 실행하고 로그인 후 다시 시도하세요.');
  }
}

/**
 * 연결된 브라우저에서 새 페이지 생성
 */
export async function newPage(browser) {
  return browser.contexts()[0].newPage();
}
