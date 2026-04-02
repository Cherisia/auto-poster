import { chromium } from 'playwright';
import { readConfig } from './config.js';

let _browser = null;

export async function getBrowser() {
  if (_browser) return _browser;
  const config = readConfig();
  _browser = await chromium.launch({
    headless: config.browser.headless,
    args: ['--lang=ko-KR'],
  });
  return _browser;
}

/**
 * 새 컨텍스트 생성
 * storageState 파일이 있으면 세션(쿠키 등) 복원
 */
export async function newContext(storageStatePath = null) {
  const browser = await getBrowser();
  const options = { locale: 'ko-KR', timezoneId: 'Asia/Seoul' };
  if (storageStatePath) options.storageState = storageStatePath;
  return browser.newContext(options);
}

export async function closeBrowser() {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}
