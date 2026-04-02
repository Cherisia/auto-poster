import 'dotenv/config';
import { existsSync } from 'fs';
import { newContext, closeBrowser } from '../core/browser.js';
import { hasSession, saveSession, sessionPath } from '../core/session.js';
import { readConfig } from '../core/config.js';
import readline from 'readline';

const BLOG_URL = process.env.TISTORY_BLOG_URL?.replace(/\/$/, '');

function waitForEnter(msg = '로그인 완료 후 Enter...') {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(msg, () => { rl.close(); resolve(); });
  });
}

/* ───────── 포스팅 ───────── */

export async function tistoryPost(post) {
  if (!BLOG_URL) throw new Error('[tistory] .env 에 TISTORY_BLOG_URL 이 없습니다.');

  const config  = readConfig();
  const isDraft = config.publish.mode === 'draft';

  console.log(`[tistory] 포스팅 시작: "${post.title}"`);
  console.log(`[tistory] 모드: ${isDraft ? '임시저장' : '발행'}`);

  // 저장된 세션이 있으면 복원, 없으면 빈 컨텍스트
  const sesPath  = hasSession('tistory') ? sessionPath('tistory') : null;
  const context  = await newContext(sesPath);
  const page     = await context.newPage();

  await page.goto(`${BLOG_URL}/manage/newpost/`, { waitUntil: 'networkidle' });

  // 로그인 필요 시 사용자가 직접 로그인 후 세션 저장
  if (page.url().includes('login') || page.url().includes('auth')) {
    console.log('');
    console.log('──────────────────────────────────────');
    console.log('  티스토리 로그인이 필요합니다');
    console.log('  브라우저에서 로그인 완료 후 Enter');
    console.log('──────────────────────────────────────');
    await waitForEnter();
    await saveSession('tistory', context);
    await page.goto(`${BLOG_URL}/manage/newpost/`, { waitUntil: 'networkidle' });
  }

  // ① 제목
  await inputTitle(page, post.title);

  // ② 이미지 업로드 → placeholder 치환
  const finalHtml = await uploadImagesAndReplace(page, post.contentHtml, post.images);

  // ③ HTML 모드 전환 후 본문 삽입
  await inputHtmlContent(page, finalHtml);

  // ④ 카테고리
  if (post.category) await setCategory(page, post.category);

  // ⑤ 태그
  if (post.tags?.length > 0) await inputTags(page, post.tags);

  // ⑥ 임시저장 or 발행
  if (isDraft) {
    await clickButton(page, ['임시저장']);
    console.log('[tistory] 임시저장 완료');
  } else {
    await clickButton(page, ['발행', '공개발행', '출간하기']);
    await handlePublishDialog(page);
    console.log('[tistory] 발행 완료');
  }

  // 포스팅 성공 후 세션 갱신 저장
  await saveSession('tistory', context);

  await page.waitForTimeout(2000);
  const resultUrl = page.url();
  await context.close();
  await closeBrowser();

  console.log(`[tistory] 완료: ${resultUrl}`);
  return resultUrl;
}

/* ───────── 내부 헬퍼 ───────── */

async function inputTitle(page, title) {
  const sel = 'input[id*="title"], [placeholder*="제목을 입력"]';
  await page.waitForSelector(sel, { timeout: 15000 });
  await page.click(sel);
  await page.fill(sel, title);
  console.log('[tistory] 제목 입력 완료');
}

async function uploadImagesAndReplace(page, html, images) {
  if (!images?.length) return html;
  let result = html;
  for (const img of images) {
    if (!existsSync(img.absolutePath)) {
      console.log(`[tistory] 이미지 없음, 스킵: ${img.filename}`);
      continue;
    }
    console.log(`[tistory] 이미지 업로드 중: ${img.filename}`);
    const cdnUrl = await uploadImage(page, img.absolutePath);
    if (cdnUrl) {
      result = result.replace(
        img.placeholder,
        `<img src="${cdnUrl}" alt="${img.filename}" style="max-width:100%;" />`
      );
      console.log(`[tistory] 업로드 완료: ${img.filename}`);
    } else {
      console.log(`[tistory] 업로드 실패, 스킵: ${img.filename}`);
    }
  }
  return result;
}

async function uploadImage(page, absolutePath) {
  try {
    const imgBtn = page.locator(
      'button[aria-label*="이미지"], button[title*="이미지"], button[class*="image"]'
    ).first();
    await imgBtn.waitFor({ timeout: 5000 });
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 5000 }),
      imgBtn.click(),
    ]);
    await fileChooser.setFiles(absolutePath);
    await page.waitForTimeout(3000);
    const cdnUrl = await page.evaluate(() => {
      const imgs = document.querySelectorAll('.ProseMirror img, [contenteditable] img');
      return imgs[imgs.length - 1]?.src || null;
    });
    if (cdnUrl) {
      await page.evaluate(() => {
        const imgs = document.querySelectorAll('.ProseMirror img, [contenteditable] img');
        imgs[imgs.length - 1]?.remove();
      });
    }
    return cdnUrl;
  } catch (err) {
    console.log(`[tistory] 이미지 업로드 오류: ${err.message}`);
    return null;
  }
}

async function inputHtmlContent(page, html) {
  const htmlModeBtn = page.locator(
    'button:has-text("HTML"), button[aria-label*="HTML"], button[title*="HTML"]'
  ).first();
  try {
    await htmlModeBtn.waitFor({ timeout: 5000 });
    await htmlModeBtn.click();
    console.log('[tistory] HTML 편집 모드 전환 완료');
    const textarea = page.locator('textarea.CodeMirror-line, .CodeMirror textarea, textarea[class*="html"]').first();
    await textarea.waitFor({ timeout: 5000 });
    await textarea.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(html, { delay: 0 });
  } catch {
    console.log('[tistory] HTML 버튼 없음 — contenteditable 직접 주입');
    await page.evaluate((html) => {
      const editor = document.querySelector('.ProseMirror, [contenteditable="true"]');
      if (editor) editor.innerHTML = html;
    }, html);
  }
  console.log('[tistory] 본문 입력 완료');
}

async function inputTags(page, tags) {
  try {
    const sel = 'input[id*="tag"], input[placeholder*="태그"]';
    await page.waitForSelector(sel, { timeout: 5000 });
    await page.click(sel);
    for (const tag of tags) {
      await page.type(sel, tag, { delay: 30 });
      await page.keyboard.press('Enter');
    }
    console.log('[tistory] 태그 입력 완료');
  } catch {
    console.log('[tistory] 태그 입력 스킵');
  }
}

async function setCategory(page, category) {
  try {
    const btn = page.locator('button:has-text("카테고리"), [class*="category"] button').first();
    await btn.waitFor({ timeout: 5000 });
    await btn.click();
    const option = page.locator(`[role="option"]:has-text("${category}"), li:has-text("${category}")`).first();
    await option.waitFor({ timeout: 3000 });
    await option.click();
    console.log(`[tistory] 카테고리 "${category}" 설정 완료`);
  } catch {
    console.log('[tistory] 카테고리 설정 스킵');
  }
}

async function clickButton(page, labels) {
  for (const label of labels) {
    const btn = page.locator(`button:has-text("${label}")`).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      return;
    }
  }
  throw new Error(`[tistory] 버튼 없음: ${labels.join(', ')}`);
}

async function handlePublishDialog(page) {
  try {
    const btn = page.locator('button:has-text("확인"), button:has-text("발행")').last();
    await btn.waitFor({ timeout: 4000 });
    await btn.click();
  } catch { /* 팝업 없으면 스킵 */ }
}
