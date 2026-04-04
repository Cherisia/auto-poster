import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().includes('newpost'));
if (!page) { console.log('newpost 페이지 없음'); process.exit(0); }

// 현재 TinyMCE 에디터 전체 HTML 확인
const html = await page.evaluate(() => {
  const ed = window.tinymce?.get('editor-tistory');
  return ed?.getContent() || document.querySelector('[contenteditable]')?.innerHTML || '없음';
});

console.log('=== 에디터 HTML ===');
console.log(html);
process.exit(0);
