import { existsSync } from 'fs';
import { connectBrowser, newPage } from '../core/browser.js';
import { readConfig } from '../core/config.js';

const BLOG_URL = process.env.TISTORY_BLOG_URL?.replace(/\/$/, '');

const SEL = {
  title:    'input[id*="title"], [placeholder*="제목을 입력"]',
  tag:      'input[id*="tag"], input[placeholder*="태그"]',
  category: '#category-btn',
  draft:    'span.btn-draft a.action',
  publish:  '#publish-layer-btn',
};

/* ───────── 진입점 ───────── */

export async function tistoryPost(post) {
  if (!BLOG_URL) throw new Error('[tistory] .env 에 TISTORY_BLOG_URL 이 없습니다.');

  const cfg   = readConfig().tistory;
  const mode  = cfg.mode; // 'draft' | 'publish' | 'schedule'
  console.log(`[tistory] 포스팅 시작: "${post.title}" (${modeLabel(mode)})`);

  const browser = await connectBrowser();
  const page    = await newPage(browser);
  page.on('dialog', d => d.dismiss().catch(() => {}));

  await page.goto(`${BLOG_URL}/manage/newpost/`, { waitUntil: 'networkidle' });

  if (page.url().includes('login') || page.url().includes('auth')) {
    await page.close();
    throw new Error('티스토리 로그인이 필요합니다. start-chrome.bat 으로 크롬을 열고 로그인 후 다시 실행하세요.');
  }

  await inputTitle(page, post.title);
  const finalHtml = await uploadImagesAndReplace(page, post.contentHtml, post.images);
  await setContent(page, finalHtml);
  if (post.category)     await setCategory(page, post.category);
  if (post.tags?.length) await inputTags(page, post.tags);

  if (mode === 'draft')    await saveDraft(page);
  else if (mode === 'schedule') await schedulePublish(page, cfg.scheduleTime || '10:00');
  else                     await publish(page);

  await page.waitForTimeout(2000);
  const url = page.url();
  await page.close();
  console.log(`[tistory] 완료: ${url}`);
  return url;
}

/* ───────── 에디터 입력 ───────── */

async function inputTitle(page, title) {
  await page.waitForSelector(SEL.title, { timeout: 15000 });
  await page.fill(SEL.title, title);
  console.log('[tistory] 제목 입력 완료');
}

async function setContent(page, html) {
  await page.evaluate(html => {
    window.tinymce?.get('editor-tistory')?.setContent(html);
  }, html);
  console.log('[tistory] 본문 입력 완료');
}

async function setCategory(page, category) {
  try {
    await page.click(SEL.category);
    await page.waitForTimeout(300);
    const opt = page.locator(`[role="option"]:has-text("${category}"), li:has-text("${category}")`).first();
    await opt.waitFor({ timeout: 3000 });
    await opt.click();
    console.log(`[tistory] 카테고리 "${category}" 설정 완료`);
  } catch {
    console.log('[tistory] 카테고리 설정 스킵');
  }
}

async function inputTags(page, tags) {
  try {
    await page.waitForSelector(SEL.tag, { timeout: 5000 });
    await page.click(SEL.tag);
    for (const tag of tags) {
      await page.type(SEL.tag, tag, { delay: 30 });
      await page.keyboard.press('Enter');
    }
    console.log('[tistory] 태그 입력 완료');
  } catch {
    console.log('[tistory] 태그 입력 스킵');
  }
}

/* ───────── 저장 / 발행 / 예약 ───────── */

async function saveDraft(page) {
  await page.evaluate(sel => {
    document.querySelector(sel)?.click();
  }, SEL.draft);
  await page.waitForTimeout(1500);
  console.log('[tistory] 임시저장 완료');
}

async function publish(page) {
  await page.click(SEL.publish);
  try {
    const btn = page.locator('button:has-text("발행"), button:has-text("공개발행"), button:has-text("확인")').last();
    await btn.waitFor({ timeout: 5000 });
    await btn.click();
    console.log('[tistory] 발행 완료');
  } catch {
    console.log('[tistory] 발행 팝업 없음');
  }
}

async function schedulePublish(page, scheduleTime) {
  const { dateStr, timeStr } = getScheduleDateTime(scheduleTime);
  console.log(`[tistory] 예약 발행: ${dateStr} ${timeStr}`);

  // 발행 레이어 열기
  await page.click(SEL.publish);
  await page.waitForTimeout(500);

  // "예약" 탭/버튼 클릭
  try {
    const scheduleTab = page.locator(
      'button:has-text("예약"), label:has-text("예약"), [class*="schedule"]:not([class*="no"])'
    ).first();
    await scheduleTab.waitFor({ timeout: 5000 });
    await scheduleTab.click();
    await page.waitForTimeout(300);
  } catch {
    console.log('[tistory] 예약 탭 없음, 스킵');
    return;
  }

  // 날짜 입력
  try {
    const dateInput = page.locator(
      'input[type="date"], input[name*="date"], [class*="date"] input[type="text"]'
    ).first();
    await dateInput.waitFor({ timeout: 3000 });
    await dateInput.fill(dateStr);
    await page.waitForTimeout(200);
  } catch {
    console.log('[tistory] 날짜 입력 스킵');
  }

  // 시간 입력
  try {
    const timeInput = page.locator(
      'input[type="time"], input[name*="time"], [class*="time"] input[type="text"]'
    ).first();
    await timeInput.waitFor({ timeout: 3000 });
    await timeInput.fill(timeStr);
    await page.waitForTimeout(200);
  } catch {
    console.log('[tistory] 시간 입력 스킵');
  }

  // 예약 발행 확인 버튼
  try {
    const confirmBtn = page.locator(
      'button:has-text("예약 발행"), button:has-text("예약발행"), button:has-text("확인")'
    ).last();
    await confirmBtn.waitFor({ timeout: 3000 });
    await confirmBtn.click();
    console.log('[tistory] 예약 발행 완료');
  } catch {
    console.log('[tistory] 예약 확인 버튼 없음, 스킵');
  }
}

/* ───────── 이미지 업로드 ───────── */

async function uploadImagesAndReplace(page, html, images) {
  if (!images?.length) return html;

  let result = html;
  for (const img of images) {
    if (!existsSync(img.absolutePath)) {
      console.log(`[tistory] 이미지 없음, 스킵: ${img.filename}`);
      continue;
    }
    console.log(`[tistory] 이미지 업로드 중: ${img.filename}`);
    const template = await uploadImage(page, img.absolutePath, img.description);
    if (template) {
      result = result.replace(img.placeholder, `<p>${template}</p>`);
      console.log(`[tistory] 업로드 완료: ${img.filename}`);
    } else {
      console.log(`[tistory] 업로드 실패, 스킵: ${img.filename}`);
    }
  }
  return result;
}

async function uploadImage(page, absolutePath, description) {
  try {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 5000 }),
      page.evaluate(async () => {
        const btn = Array.from(document.querySelectorAll('[aria-label="첨부"]'))
          .find(el => el.offsetParent !== null);
        btn?.click();
        await new Promise(r => setTimeout(r, 400));
        document.getElementById('attach-image')?.click();
      }),
    ]);
    await fileChooser.setFiles(absolutePath);
    await page.waitForTimeout(4000);

    return await page.evaluate((desc) => {
      const ed = window.tinymce?.get('editor-tistory');
      if (!ed) return null;

      const content = ed.getContent();
      const match   = content.match(/\[##_Image\|([^|]+)\|CDM\|([^|]+)\|(\{.*?\})_##\]/);
      if (!match) return null;

      let template = match[0];
      if (desc) {
        try {
          const meta  = JSON.parse(match[3]);
          meta.caption = desc;
          template = `[##_Image|${match[1]}|CDM|${match[2]}|${JSON.stringify(meta)}_##]`;
        } catch {
          template = template.replace(/"caption":"[^"]*"/, `"caption":"${desc.replace(/"/g, '\\"')}"`);
        }
      }

      ed.setContent(content.replace(match[0], '').trim());
      return template;
    }, description || '');

  } catch (err) {
    console.log(`[tistory] 이미지 업로드 오류: ${err.message}`);
    return null;
  }
}

/* ───────── 유틸 ───────── */

/** 다음날 scheduleTime(HH:MM) 기준 날짜/시간 문자열 반환 */
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
