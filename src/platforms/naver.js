import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { resolve, join, extname } from 'path';
import { connectBrowser, newPage } from '../core/browser.js';
import { readConfig } from '../core/config.js';

const BLOG_ID   = process.env.NAVER_BLOG_ID;
const WRITE_URL = `https://blog.naver.com/${BLOG_ID}/postwrite`;

// DOM 검사로 확인한 정확한 셀렉터
const SEL = {
  // 에디터
  title:         '.se-title-text',
  editor:        '.se-section-text',
  popup:         '.se-popup-button-cancel',
  // 이미지 삽입 (툴바 → insert-menu → 사진 버튼 → hidden-file)
  imgToolbar:    'button[data-name="image"]',
  imgInMenu:     '.se-insert-menu-button-image',
  fileInput:     '#hidden-file',
  // 헤더 버튼
  saveBtn:       'button[class*="save_btn"]:not([class*="count"])',
  pubBtn:        'button[class*="publish_btn"]',
  // 발행 패널 내부 (pubBtn 클릭 후 나타남)
  confirmBtn:    'button[class*="confirm_btn"]',
  tagInput:      'input[class*="tag_input"]',
  topicBtn:      'button[class*="selectbox_button"]',
  scheduleRadio: 'input[name="radio_time"][value="pre"]',
};

/* ───────── 진입점 ───────── */

export async function naverPost(post) {
  if (!BLOG_ID) throw new Error('[naver] .env 에 NAVER_BLOG_ID 가 없습니다.');

  const cfg  = readConfig().naver;
  const mode = cfg.mode;
  console.log(`[naver] 포스팅 시작: "${post.title}" (${modeLabel(mode)})`);

  const browser  = await connectBrowser();
  const tempPath = buildTempHtml(post);
  console.log(`[naver] temp HTML 생성: ${tempPath}`);

  // ① 텍스트 본문 복사
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

  // ④ 이미지 업로드
  if (post.images?.length) await uploadImages(page, post.images);

  // ⑤ 제목 입력
  await inputTitle(page, post.title);

  // ⑥ 임시저장 or 발행 패널 오픈
  //    태그·주제·예약은 발행 패널 안에 있으므로 패널 열고 나서 처리
  if (mode === 'draft') {
    await saveDraft(page);
  } else {
    await openAndSubmitPublishPanel(page, post, mode, cfg.scheduleTime || '10:00');
  }

  await page.waitForTimeout(2000);
  const url = page.url();
  await page.close();
  await htmlPage.close();

  try { unlinkSync(tempPath); } catch {}

  console.log(`[naver] 완료: ${url}`);
  return url;
}

/* ───────── temp HTML 빌드 ───────── */

function buildTempHtml(post) {
  let content = post.contentHtml;

  // 이미지 플레이스홀더 제거 (이미지는 SE3 네이티브 업로드로 별도 삽입)
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

  const tempDir = resolve('./temp');
  if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });

  const tempPath = join(tempDir, 'naver-post.html').replace(/\\/g, '/');
  writeFileSync(tempPath, html, 'utf-8');
  return tempPath;
}

/* ───────── 이미지 업로드 ───────── */

/**
 * OS 파일 다이얼로그를 완전히 우회:
 * 파일을 Node.js에서 base64로 읽어 브라우저 컨텍스트에서
 * DataTransfer API로 #hidden-file 인풋에 직접 주입
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
    await page.waitForTimeout(300);

    try {
      // 파일을 base64로 읽기 (Node.js)
      const ext    = extname(img.absolutePath).slice(1).toLowerCase();
      const mime   = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }[ext] || 'image/png';
      const base64 = readFileSync(img.absolutePath).toString('base64');

      // 툴바 버튼은 에디터에 내용이 있으면 파일 다이얼로그를 바로 열어버림
      // → page.evaluate 안에서 hidden 상태의 se-insert-menu-button-image를
      //   직접 click() 하면서 파일 다이얼로그를 동시에 차단 후 DataTransfer 주입
      const ok = await page.evaluate(async ({ base64Data, mimeType, filename, menuBtnSel, fileInputSel }) => {
        const input     = document.querySelector(fileInputSel);
        const insertBtn = document.querySelector(menuBtnSel); // hidden 이어도 DOM에 존재
        if (!input) return 'no-input';
        if (!insertBtn) return 'no-btn';

        // #hidden-file 의 click 이벤트를 캡처 페이즈에서 차단 → OS 다이얼로그 방지
        const block = e => { e.preventDefault(); e.stopImmediatePropagation(); };
        input.addEventListener('click', block, true);

        // hidden 상태여도 element.click()은 동작 → SE3 삽입 컨텍스트 설정
        insertBtn.click();
        await new Promise(r => setTimeout(r, 300));

        input.removeEventListener('click', block, true);

        // base64 → Uint8Array → File
        const bytes  = atob(base64Data);
        const buffer = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
        const file = new File([buffer], filename, { type: mimeType });

        // DataTransfer로 input.files 설정 → change 이벤트 → SE3 업로드 트리거
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('input',  { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return 'ok';
      }, { base64Data: base64, mimeType: mime, filename: img.filename, menuBtnSel: SEL.imgInMenu, fileInputSel: SEL.fileInput });

      if (ok !== 'ok') throw new Error(`주입 실패: ${ok}`);

      await page.waitForTimeout(4000); // 업로드 완료 대기

      if (img.description) await inputImageCaption(page, img.description);

      console.log(`[naver] 이미지 업로드 완료: ${img.filename}`);
    } catch (err) {
      console.log(`[naver] 이미지 업로드 실패, 스킵: ${img.filename} (${err.message})`);
    }
  }
}

async function inputImageCaption(page, description) {
  try {
    const caption = page.locator(
      '[class*="caption"] [contenteditable="true"], [class*="caption"] input, [placeholder*="설명을 입력"]'
    ).last();
    if (await caption.isVisible({ timeout: 2000 })) {
      await caption.click();
      await caption.type(description, { delay: 20 });
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

/* ───────── 저장 / 발행 패널 ───────── */

async function saveDraft(page) {
  try {
    await page.click(SEL.saveBtn);
    await page.waitForTimeout(1500);
    console.log('[naver] 임시저장 완료');
  } catch {
    console.log('[naver] 임시저장 버튼 없음, 스킵');
  }
}

/**
 * 발행 버튼 클릭 → 패널에서 주제·태그·예약 설정 → 확인
 * 태그와 주제는 발행 패널 안에 있으므로 패널 오픈 후 입력
 */
async function openAndSubmitPublishPanel(page, post, mode, scheduleTime) {
  await page.click(SEL.pubBtn);
  await page.waitForSelector(SEL.confirmBtn, { timeout: 5000 });
  await page.waitForTimeout(500);
  console.log('[naver] 발행 패널 열림');

  if (post.category)     await setTopic(page, post.category);
  if (post.tags?.length) await inputTags(page, post.tags);
  if (mode === 'schedule') await setScheduleTime(page, scheduleTime);

  await page.click(SEL.confirmBtn);
  console.log(`[naver] ${modeLabel(mode)} 완료`);
}

async function setTopic(page, category) {
  try {
    await page.click(SEL.topicBtn);
    await page.waitForTimeout(300);
    const opt = page.locator(`li:has-text("${category}"), [role="option"]:has-text("${category}")`).first();
    await opt.waitFor({ timeout: 3000 });
    await opt.click();
    console.log(`[naver] 주제 "${category}" 설정 완료`);
  } catch {
    console.log('[naver] 주제 설정 스킵');
  }
}

async function inputTags(page, tags) {
  try {
    await page.waitForSelector(SEL.tagInput, { timeout: 3000 });
    await page.click(SEL.tagInput);
    for (const tag of tags) {
      await page.type(SEL.tagInput, tag, { delay: 30 });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
    }
    console.log('[naver] 태그 입력 완료');
  } catch {
    console.log('[naver] 태그 입력 스킵');
  }
}

async function setScheduleTime(page, scheduleTime) {
  const { dateStr, timeStr } = getScheduleDateTime(scheduleTime);
  console.log(`[naver] 예약 시각: ${dateStr} ${timeStr}`);

  // "예약" 라디오 버튼 클릭
  try {
    await page.evaluate((sel) => {
      const radio = document.querySelector(sel);
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        // 라디오와 연결된 label 클릭으로 UI 업데이트
        radio.closest('li, div, span')?.querySelector('label')?.click()
          || radio.nextElementSibling?.click()
          || radio.parentElement?.querySelector('label')?.click();
      }
    }, SEL.scheduleRadio);
    await page.waitForTimeout(500);
    console.log('[naver] 예약 라디오 선택 완료');
  } catch {
    console.log('[naver] 예약 라디오 선택 스킵');
    return;
  }

  // 날짜 입력 (YYYY-MM-DD 또는 커스텀 포맷 모두 시도)
  try {
    const dateInput = page.locator('input[type="date"], [class*="date_input"] input, [class*="dateinput"] input').first();
    await dateInput.waitFor({ timeout: 3000 });
    await dateInput.fill(dateStr);
    await page.waitForTimeout(200);
    console.log(`[naver] 날짜 입력: ${dateStr}`);
  } catch {
    console.log('[naver] 날짜 입력 스킵');
  }

  // 시간 입력 (HH:MM 또는 커스텀 포맷)
  try {
    const timeInput = page.locator('input[type="time"], [class*="time_input"] input, [class*="timeinput"] input').first();
    await timeInput.waitFor({ timeout: 3000 });
    await timeInput.fill(timeStr);
    await page.waitForTimeout(200);
    console.log(`[naver] 시간 입력: ${timeStr}`);
  } catch {
    console.log('[naver] 시간 입력 스킵');
  }
}

/* ───────── 유틸 ───────── */

function getScheduleDateTime(scheduleTime) {
  const [hour, minute] = (scheduleTime || '10:00').split(':').map(Number);
  const d = new Date();
  d.setDate(d.getDate() + 1);

  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return { dateStr, timeStr };
}

function modeLabel(mode) {
  return { draft: '임시저장', publish: '즉시발행', schedule: '예약발행' }[mode] || mode;
}
