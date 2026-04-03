import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().includes('newpost'));
if (!page) { console.log('newpost 페이지 없음'); process.exit(0); }

// 이미지 업로드 테스트: JS로 직접 클릭
console.log('JS로 mceu_0 → attach-image 클릭...');
const [fileChooser] = await Promise.all([
  page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null),
  page.evaluate(async () => {
    document.getElementById('mceu_0').click();
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('attach-image').click();
  }),
]);
console.log('fileChooser:', fileChooser ? '열림!' : '안열림');

// TinyMCE setContent 테스트
console.log('\nTinyMCE setContent 테스트...');
const setResult = await page.evaluate(() => {
  const ed = window.tinymce?.get('editor-tistory');
  if (!ed) return 'editor 없음';
  ed.setContent('<p>테스트 콘텐츠 <strong>볼드</strong></p>');
  return ed.getContent().slice(0, 100);
});
console.log('setContent 결과:', setResult);
process.exit(0);
