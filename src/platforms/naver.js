import 'dotenv/config';
import { existsSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { resolve, join } from 'path';
import { connectBrowser, newPage } from '../core/browser.js';
import { readConfig } from '../core/config.js';
import { imageToDataUri } from '../content/loader.js';

const BLOG_ID   = process.env.NAVER_BLOG_ID;
const WRITE_URL = `https://blog.naver.com/${BLOG_ID}/postwrite`;

const SEL = {
  title:    '.se-title-text',
  editor:   '.se-section-text',        // 본문 텍스트 영역
  popup:    '.se-popup-button-cancel', // SE3 팝업 닫기 버튼
  tag:      'input[placeholder*="태그"], .se-tag-input input',
  topic:    'select[name="categoryNo"], [class*="category_select"], [class*="topic"]',
  saveBtn:  'button[class*="save_btn"]',
  pubBtn:   'button[class*="publish_btn"]',
};

/* ───────── 진입점 ───────── */

export async function naverPost(post) {
  if (!BLOG_ID) throw new Error('[naver] .env 에 NAVER_BLOG_ID 가 없습니다.');

  const isDraft = readConfig().publish.mode === 'draft';
  console.log(`[naver] 포스팅 시작: "${post.title}" (${isDraft ? '임시저장' : '발행'})`);

  const browser = await connectBrowser();

  // ① naver.html 을 이미지 포함(base64)한 temp 파일로 만들어 복사
  const tempPath = buildTempHtml(post);
  console.log(`[naver] temp HTML 생성: ${tempPath}`);

  const htmlPage = await newPage(browser);
  await htmlPage.goto(`file:///${tempPath}`, { waitUntil: 'domcontentloaded' });
  await htmlPage.waitForTimeout(1500);

  // 전체 선택 후 복사 (body 클릭 → Ctrl+A → Ctrl+C)
  await htmlPage.click('body');
  await htmlPage.waitForTimeout(200);
  await htmlPage.keyboard.press('Control+a');
  await htmlPage.waitForTimeout(200);
  await htmlPage.keyboard.press('Control+c');
  await htmlPage.waitForTimeout(300);
  console.log('[naver] 본문 복사 완료');

  // ② 네이버 글쓰기 페이지
  const page = await newPage(browser);
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(WRITE_URL, { waitUntil: 'networkidle' });

  if (page.url().includes('login') || page.url().includes('nid.naver')) {
    await page.close();
    await htmlPage.close();
    throw new Error('네이버 로그인이 필요합니다. start-chrome.bat 으로 크롬을 열고 로그인 후 다시 실행하세요.');
  }

  await page.waitForSelector(SEL.editor, { timeout: 15000 });
  await page.waitForTimeout(1500);

  // SE3 팝업(이전 작성 글 알림 등) 닫기
  await dismissPopup(page);
  console.log('[naver] 에디터 접속 완료');

  // ③ 에디터 클릭 후 붙여넣기
  await page.click(SEL.editor, { force: true });
  await page.waitForTimeout(300);
  await page.keyboard.press('Control+v');
  await page.waitForTimeout(3000); // 이미지 업로드 대기
  console.log('[naver] 본문 붙여넣기 완료');

  // ④ 제목 입력
  await inputTitle(page, post.title);

  // ⑤ 주제(카테고리) 설정
  if (post.category) await setTopic(page, post.category);

  // ⑥ 태그 입력
  if (post.tags?.length) await inputTags(page, post.tags);

  // ⑦ 임시저장 or 발행
  isDraft ? await saveDraft(page) : await publish(page);

  await page.waitForTimeout(2000);
  const url = page.url();
  await page.close();
  await htmlPage.close();

  // temp 파일 삭제
  try { unlinkSync(tempPath); } catch {}

  console.log(`[naver] 완료: ${url}`);
  return url;
}

/* ───────── temp HTML 빌드 ───────── */

function buildTempHtml(post) {
  let content = post.contentHtml;

  // 이미지 플레이스홀더 → base64 data URI + 캡션
  for (const img of post.images || []) {
    if (!existsSync(img.absolutePath)) continue;
    try {
      const dataUri = imageToDataUri(img.absolutePath);
      const alt     = img.description || img.filename;
      const caption = img.description
        ? `<p style="text-align:center;color:#666;font-size:0.9em;">${img.description}</p>`
        : '';
      content = content.replace(
        img.placeholder,
        `<img src="${dataUri}" alt="${alt}" style="max-width:100%;" />${caption}`
      );
    } catch {
      console.log(`[naver] 이미지 변환 실패, 스킵: ${img.filename}`);
    }
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:sans-serif;line-height:1.7;}</style></head>
<body>
${content}
</body>
</html>`;

  const tempDir = resolve('./temp');
  if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
  const tempPath = join(tempDir, 'naver-post.html').replace(/\\/g, '/');
  writeFileSync(tempPath, html, 'utf-8');
  return tempPath;
}

/* ───────── 에디터 입력 ───────── */

async function dismissPopup(page) {
  try {
    // SE3 팝업 (이전 작성 글, 확인/취소 등)
    const popup = await page.$(SEL.popup);
    if (popup) {
      await popup.click();
      await page.waitForTimeout(300);
      console.log('[naver] 팝업 닫기 완료');
    }
  } catch { /* 팝업 없으면 무시 */ }
}

async function inputTitle(page, title) {
  try {
    await page.click(SEL.title);
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+a');
    await page.keyboard.type(title, { delay: 20 });
    console.log('[naver] 제목 입력 완료');
  } catch {
    console.log('[naver] 제목 입력 스킵');
  }
}

async function setTopic(page, category) {
  try {
    // select 방식
    const sel = await page.$(SEL.topic);
    if (sel) {
      await page.selectOption(SEL.topic, { label: category });
      console.log(`[naver] 주제 "${category}" 설정 완료`);
      return;
    }
    // 버튼 방식
    const btn = page.locator(`[class*="category"] button, [class*="topic"] button`).first();
    if (await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(300);
      const opt = page.locator(`li:has-text("${category}"), [role="option"]:has-text("${category}")`).first();
      await opt.waitFor({ timeout: 3000 });
      await opt.click();
      console.log(`[naver] 주제 "${category}" 설정 완료`);
    }
  } catch {
    console.log('[naver] 주제 설정 스킵');
  }
}

async function inputTags(page, tags) {
  try {
    const sel = await page.$(SEL.tag);
    if (!sel) { console.log('[naver] 태그 입력창 없음, 스킵'); return; }
    await page.click(SEL.tag);
    for (const tag of tags) {
      await page.type(SEL.tag, tag, { delay: 30 });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
    }
    console.log('[naver] 태그 입력 완료');
  } catch {
    console.log('[naver] 태그 입력 스킵');
  }
}

async function saveDraft(page) {
  try {
    await page.click(SEL.saveBtn);
    await page.waitForTimeout(1500);
    console.log('[naver] 임시저장 완료');
  } catch {
    console.log('[naver] 임시저장 버튼 없음, 스킵');
  }
}

async function publish(page) {
  try {
    await page.click(SEL.pubBtn);
    await page.waitForTimeout(500);
    // 발행 확인 팝업
    const confirm = page.locator('button:has-text("발행"), button:has-text("확인")').last();
    if (await confirm.isVisible()) await confirm.click();
    console.log('[naver] 발행 완료');
  } catch {
    console.log('[naver] 발행 버튼 없음, 스킵');
  }
}
