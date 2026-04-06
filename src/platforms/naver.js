import { existsSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { resolve, join } from 'path';
import { connectBrowser, newPage } from '../core/browser.js';
import { readConfig } from '../core/config.js';

const BLOG_ID   = process.env.NAVER_BLOG_ID;
const WRITE_URL = `https://blog.naver.com/${BLOG_ID}/postwrite`;

const SEL = {
  title:   '.se-title-text',
  editor:  '.se-section-text',
  popup:   '.se-popup-button-cancel',
  tag:     'input[placeholder*="태그"], .se-tag-input input',
  topic:   'select[name="categoryNo"], [class*="category_select"], [class*="topic"]',
  saveBtn: 'button[class*="save_btn"]',
  pubBtn:  'button[class*="publish_btn"]',
};

// SE3 툴바 이미지 버튼 후보 셀렉터 (우선순위 순)
const IMAGE_BTN_SELS = [
  '.se-toolbar [data-se-type="image"]',
  '.se-toolbar button[title*="사진"]',
  '.se-toolbar [class*="photo"]',
  '.se-toolbar [class*="image"]:not([class*="text-image"])',
  '[class*="toolbar"] button[title*="사진"]',
  '[class*="toolbar"] [class*="photo"]',
];

/* ───────── 진입점 ───────── */

export async function naverPost(post) {
  if (!BLOG_ID) throw new Error('[naver] .env 에 NAVER_BLOG_ID 가 없습니다.');

  const cfg  = readConfig().naver;
  const mode = cfg.mode;
  console.log(`[naver] 포스팅 시작: "${post.title}" (${modeLabel(mode)})`);

  const browser  = await connectBrowser();
  const tempPath = buildTempHtml(post);
  console.log(`[naver] temp HTML 생성: ${tempPath}`);

  // ① 텍스트 본문 복사 (이미지 플레이스홀더 제거된 HTML)
  const htmlPage = await newPage(browser);
  await htmlPage.goto(`file:///${tempPath}`, { waitUntil: 'domcontentloaded' });
  await htmlPage.waitForTimeout(1500);
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
  await dismissPopup(page);
  console.log('[naver] 에디터 접속 완료');

  // ③ 텍스트 붙여넣기
  await page.click(SEL.editor, { force: true });
  await page.waitForTimeout(300);
  await page.keyboard.press('Control+v');
  await page.waitForTimeout(2000);
  console.log('[naver] 본문 붙여넣기 완료');

  // ④ 이미지 업로드 (SE3 네이티브 방식)
  if (post.images?.length) {
    await uploadImages(page, post.images);
  }

  // ⑤ 제목 / 주제 / 태그
  await inputTitle(page, post.title);
  if (post.category)     await setTopic(page, post.category);
  if (post.tags?.length) await inputTags(page, post.tags);

  // ⑥ 임시저장 / 즉시발행 / 예약발행
  if (mode === 'draft')         await saveDraft(page);
  else if (mode === 'schedule') await schedulePublish(page, cfg.scheduleTime || '10:00');
  else                          await publish(page);

  await page.waitForTimeout(2000);
  const url = page.url();
  await page.close();
  await htmlPage.close();

  try { unlinkSync(tempPath); } catch {}

  console.log(`[naver] 완료: ${url}`);
  return url;
}

/* ───────── temp HTML 빌드 (텍스트 전용) ───────── */

/**
 * 이미지 플레이스홀더를 제거한 텍스트 전용 HTML 생성
 * 이미지는 SE3 네이티브 업로드로 별도 삽입
 */
function buildTempHtml(post) {
  let content = post.contentHtml;

  // 이미지 플레이스홀더 제거
  for (const img of post.images || []) {
    content = content.replace(img.placeholder, '');
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:sans-serif;line-height:1.7;}</style></head>
<body>
${content}
</body>
</html>`;

  const tempDir  = resolve('./temp');
  if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });

  const tempPath = join(tempDir, 'naver-post.html').replace(/\\/g, '/');
  writeFileSync(tempPath, html, 'utf-8');
  return tempPath;
}

/* ───────── 이미지 업로드 ───────── */

/**
 * 각 이미지를 SE3 툴바 이미지 버튼으로 업로드
 * 에디터 마지막 위치에 순서대로 삽입
 */
async function uploadImages(page, images) {
  for (const img of images) {
    if (!existsSync(img.absolutePath)) {
      console.log(`[naver] 이미지 없음, 스킵: ${img.filename}`);
      continue;
    }

    console.log(`[naver] 이미지 업로드 중: ${img.filename}`);

    // 에디터 끝으로 커서 이동
    await page.click(SEL.editor, { force: true });
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+End');
    await page.waitForTimeout(200);

    try {
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 8000 }),
        clickImageButton(page),
      ]);
      await fileChooser.setFiles(img.absolutePath);
      await page.waitForTimeout(4000); // 업로드 완료 대기

      // 캡션 입력
      if (img.description) await inputImageCaption(page, img.description);

      console.log(`[naver] 이미지 업로드 완료: ${img.filename}`);
    } catch (err) {
      console.log(`[naver] 이미지 업로드 실패, 스킵: ${img.filename} (${err.message})`);
    }
  }
}

async function clickImageButton(page) {
  const found = await page.evaluate((sels) => {
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (el) { el.click(); return sel; }
    }
    return null;
  }, IMAGE_BTN_SELS);

  if (!found) throw new Error('SE3 이미지 버튼을 찾을 수 없음');
  console.log(`[naver] 이미지 버튼 클릭: ${found}`);
}

async function inputImageCaption(page, description) {
  try {
    await page.waitForTimeout(500);
    const captionSel = page.locator(
      '[class*="caption"] [contenteditable="true"], [class*="caption"] input, [placeholder*="설명을 입력"]'
    ).last();
    if (await captionSel.isVisible({ timeout: 2000 })) {
      await captionSel.click();
      await captionSel.type(description, { delay: 20 });
      await page.keyboard.press('Escape');
      console.log(`[naver] 캡션 입력: ${description}`);
    }
  } catch {
    console.log('[naver] 캡션 입력 스킵');
  }
}

/* ───────── 에디터 입력 ───────── */

async function dismissPopup(page) {
  try {
    const popup = await page.$(SEL.popup);
    if (popup) {
      await popup.click();
      await page.waitForTimeout(300);
      console.log('[naver] 팝업 닫기 완료');
    }
  } catch {}
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
    if (await page.$(SEL.topic)) {
      await page.selectOption(SEL.topic, { label: category });
      console.log(`[naver] 주제 "${category}" 설정 완료`);
      return;
    }
    const btn = page.locator('[class*="category"] button, [class*="topic"] button').first();
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
    if (!await page.$(SEL.tag)) { console.log('[naver] 태그 입력창 없음, 스킵'); return; }
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

/* ───────── 저장 / 발행 / 예약 ───────── */

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
    const confirm = page.locator('button:has-text("발행"), button:has-text("확인")').last();
    if (await confirm.isVisible()) await confirm.click();
    console.log('[naver] 발행 완료');
  } catch {
    console.log('[naver] 발행 버튼 없음, 스킵');
  }
}

async function schedulePublish(page, scheduleTime) {
  const { dateStr, timeStr } = getScheduleDateTime(scheduleTime);
  console.log(`[naver] 예약 발행: ${dateStr} ${timeStr}`);

  try {
    await page.click(SEL.pubBtn);
    await page.waitForTimeout(500);
  } catch {
    console.log('[naver] 발행 버튼 없음, 스킵');
    return;
  }

  try {
    const scheduleOpt = page.locator(
      'button:has-text("예약"), label:has-text("예약"), [class*="reserve"], [class*="schedule"]'
    ).first();
    await scheduleOpt.waitFor({ timeout: 5000 });
    await scheduleOpt.click();
    await page.waitForTimeout(300);
  } catch {
    console.log('[naver] 예약 옵션 없음, 스킵');
    return;
  }

  try {
    const dateInput = page.locator('input[type="date"], [class*="date"] input, input[placeholder*="날짜"]').first();
    await dateInput.waitFor({ timeout: 3000 });
    await dateInput.fill(dateStr);
    await page.waitForTimeout(200);
  } catch {
    console.log('[naver] 날짜 입력 스킵');
  }

  try {
    const timeInput = page.locator('input[type="time"], [class*="time"] input, input[placeholder*="시간"]').first();
    await timeInput.waitFor({ timeout: 3000 });
    await timeInput.fill(timeStr);
    await page.waitForTimeout(200);
  } catch {
    console.log('[naver] 시간 입력 스킵');
  }

  try {
    const confirmBtn = page.locator(
      'button:has-text("예약 발행"), button:has-text("예약발행"), button:has-text("확인")'
    ).last();
    await confirmBtn.waitFor({ timeout: 3000 });
    await confirmBtn.click();
    console.log('[naver] 예약 발행 완료');
  } catch {
    console.log('[naver] 예약 확인 버튼 없음, 스킵');
  }
}

/* ───────── 유틸 ───────── */

function getScheduleDateTime(scheduleTime) {
  const [hour, minute] = (scheduleTime || '10:00').split(':').map(Number);
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);

  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return { dateStr, timeStr };
}

function modeLabel(mode) {
  return { draft: '임시저장', publish: '즉시발행', schedule: '예약발행' }[mode] || mode;
}
