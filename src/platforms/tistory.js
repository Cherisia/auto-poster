import 'dotenv/config';
import { existsSync } from 'fs';
import { newContext } from '../core/browser.js';
import { saveSession, loadSession } from '../core/session.js';
import { readConfig } from '../core/config.js';

const TISTORY_MAIN_URL = 'https://www.tistory.com';
const BLOG_URL = process.env.TISTORY_BLOG_URL?.replace(/\/$/, '');

/* ───────── 로그인 ───────── */

export async function tistoryLogin(force = false) {
  const existing = loadSession('tistory');
  if (existing && !force) {
    console.log('[tistory] 저장된 세션 사용');
    return existing;
  }

  console.log('[tistory] 로그인 브라우저 열기...');
  const context = await newContext();
  const page    = await context.newPage();
  await page.goto('https://www.tistory.com/auth/login', { waitUntil: 'domcontentloaded' });

  console.log('');
  console.log('──────────────────────────────────────');
  console.log('  브라우저에서 직접 로그인해주세요:');
  console.log('  1. 카카오계정으로 로그인 버튼 클릭');
  console.log('  2. 이메일 / 비밀번호 입력');
  console.log('  3. 추가 인증 완료');
  console.log('  4. 티스토리 메인이 뜨면 여기서 Enter');
  console.log('──────────────────────────────────────');

  await waitForUserInput();
  console.log('[tistory] 로그인 완료 확인됨');
  await saveSession('tistory', context);
  await context.close();
  return loadSession('tistory');
}

/* ───────── 세션 확인 ───────── */

export async function checkTistorySession() {
  const session = loadSession('tistory');
  if (!session) return false;

  const context = await newContext(session);
  const page    = await context.newPage();
  await page.goto(TISTORY_MAIN_URL, { waitUntil: 'domcontentloaded' });

  const isLoggedIn = await page.locator('a[href*="/manage"]').first()
    .isVisible().catch(() => false);
  await context.close();

  console.log(isLoggedIn ? '[tistory] 세션 유효' : '[tistory] 세션 만료 — 재로그인 필요');
  return isLoggedIn;
}

/* ───────── 포스팅 ───────── */

/**
 * @param {object} post
 *   title, contentHtml, tags, category,
 *   images: [{ placeholder, filename, absolutePath }]
 */
export async function tistoryPost(post) {
  const session = loadSession('tistory');
  if (!session) throw new Error('[tistory] 세션 없음. 먼저 로그인: node index.js --login tistory');
  if (!BLOG_URL)  throw new Error('[tistory] .env 에 TISTORY_BLOG_URL 이 없습니다.');

  const config  = readConfig();
  const isDraft = config.publish.mode === 'draft';

  console.log(`[tistory] 포스팅 시작: "${post.title}"`);
  console.log(`[tistory] 모드: ${isDraft ? '임시저장' : '발행'}`);

  const context = await newContext(session);
  const page    = await context.newPage();

  // 글쓰기 페이지 이동
  await page.goto(`${BLOG_URL}/manage/newpost/`, { waitUntil: 'networkidle' });

  if (page.url().includes('login') || page.url().includes('auth')) {
    await context.close();
    throw new Error('[tistory] 세션 만료. 재로그인: node index.js --login tistory');
  }

  // ① 제목 입력
  await inputTitle(page, post.title);

  // ② 이미지 업로드 → placeholder 치환된 HTML 획득
  const finalHtml = await uploadImagesAndReplace(page, post.contentHtml, post.images);

  // ③ HTML 모드로 전환 후 본문 삽입
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

  await page.waitForTimeout(2000);
  const resultUrl = page.url();
  await context.close();

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

/**
 * 이미지 업로드 후 placeholder → <img> 태그로 치환된 HTML 반환
 */
async function uploadImagesAndReplace(page, html, images) {
  if (!images || images.length === 0) return html;

  let result = html;

  for (const img of images) {
    if (!existsSync(img.absolutePath)) {
      console.log(`[tistory] 이미지 파일 없음, 스킵: ${img.filename}`);
      continue;
    }

    console.log(`[tistory] 이미지 업로드 중: ${img.filename}`);
    const cdnUrl = await uploadImage(page, img.absolutePath);

    if (cdnUrl) {
      result = result.replace(
        img.placeholder,
        `<img src="${cdnUrl}" alt="${img.filename}" style="max-width:100%;" />`
      );
      console.log(`[tistory] 이미지 치환 완료: ${img.filename} → ${cdnUrl}`);
    } else {
      console.log(`[tistory] 이미지 업로드 실패, placeholder 유지: ${img.filename}`);
    }
  }

  return result;
}

/**
 * 티스토리 이미지 업로드
 * 툴바의 이미지 버튼 클릭 → 파일 선택 → CDN URL 반환
 */
async function uploadImage(page, absolutePath) {
  try {
    // 이미지 업로드 버튼 클릭 (툴바 아이콘)
    const imgBtn = page.locator(
      'button[aria-label*="이미지"], button[title*="이미지"], button[class*="image"]'
    ).first();
    await imgBtn.waitFor({ timeout: 5000 });

    // 파일 선택 다이얼로그 가로채기
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 5000 }),
      imgBtn.click(),
    ]);
    await fileChooser.setFiles(absolutePath);

    // 업로드 완료 후 삽입된 img src 가져오기
    await page.waitForTimeout(3000);

    // 마지막으로 삽입된 img 태그의 src 수집
    const cdnUrl = await page.evaluate(() => {
      const imgs = document.querySelectorAll('.ProseMirror img, [contenteditable] img');
      const last = imgs[imgs.length - 1];
      return last?.src || null;
    });

    // 업로드 직후 삽입된 이미지는 다시 지워야 함 (나중에 HTML로 통째 넣을 것)
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

/**
 * HTML 편집 모드로 전환 후 본문 삽입
 */
async function inputHtmlContent(page, html) {
  // HTML 편집 버튼 클릭 (</>  또는 "HTML" 텍스트 버튼)
  const htmlModeBtn = page.locator(
    'button:has-text("HTML"), button[aria-label*="HTML"], button[title*="HTML"], button.html-btn'
  ).first();

  try {
    await htmlModeBtn.waitFor({ timeout: 5000 });
    await htmlModeBtn.click();
    console.log('[tistory] HTML 편집 모드 전환 완료');

    // HTML 편집 textarea 에 내용 입력
    const textarea = page.locator('textarea.CodeMirror-line, .CodeMirror, textarea[class*="html"]').first();
    await textarea.waitFor({ timeout: 5000 });
    await textarea.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(html, { delay: 0 });

  } catch {
    // HTML 버튼이 없으면 contenteditable 에 직접 innerHTML 주입
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

function waitForUserInput() {
  return new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
}
