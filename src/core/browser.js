import { chromium } from 'playwright';
import { readConfig } from './config.js';

let browser = null;

/**
 * 브라우저 인스턴스를 반환. 이미 열려있으면 재사용.
 */
export async function getBrowser() {
  if (browser) return browser;

  const config = readConfig();
  browser = await chromium.launch({
    headless: config.browser.headless,
    args: ['--lang=ko-KR'],
  });

  return browser;
}

/**
 * 새 브라우저 컨텍스트 생성.
 * storageState 를 넘기면 저장된 세션(쿠키 등)을 복원.
 */
export async function newContext(storageState = null) {
  const b = await getBrowser();
  const options = {
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  };
  if (storageState) options.storageState = storageState;
  return b.newContext(options);
}

/**
 * 브라우저 종료.
 */
export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
