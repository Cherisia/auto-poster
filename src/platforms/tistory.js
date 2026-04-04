import 'dotenv/config';
import { existsSync } from 'fs';
import { connectBrowser, newPage } from '../core/browser.js';
import { readConfig } from '../core/config.js';

const BLOG_URL = process.env.TISTORY_BLOG_URL?.replace(/\/$/, '');

export async function tistoryPost(post) {
  if (!BLOG_URL) throw new Error('[tistory] .env 에 TISTORY_BLOG_URL 이 없습니다.');

  const config  = readConfig();
  const isDraft = config.publish.mode === 'draft';

  console.log(`[tistory] 포스팅 시작: "${post.title}"`);
  console.log(`[tistory] 모드: ${isDraft ? '임시저장' : '발행'}`);

  const browser = await connectBrowser();
  const page    = await newPage(browser);

  page.on('dialog', dialog => dialog.dismiss().catch(() => {}));

  await page.goto(`${BLOG_URL}/manage/newpost/`, { waitUntil: 'networkidle' });

  if (page.url().includes('login') || page.url().includes('auth')) {
    await page.close();
    throw new Error('티스토리 로그인이 필요합니다. start-chrome.bat 으로 크롬을 열고 로그인 후 다시 실행하세요.');
  }

  console.log('[tistory] 에디터 접속 완료');

  // ① 제목
  await inputTitle(page, post.title);

  // ② 이미지 업로드 → placeholder 치환
  const finalHtml = await uploadImagesAndReplace(page, post.contentHtml, post.images);

  // ③ TinyMCE로 본문 주입
  await inputHtmlContent(page, finalHtml);

  // ④ 카테고리
  if (post.category) await setCategory(page, post.category);

  // ⑤ 태그
  if (post.tags?.length > 0) await inputTags(page, post.tags);

  // ⑥ 임시저장 or 발행
  if (isDraft) {
    await saveDraft(page);
  } else {
    await publish(page);
  }

  await page.waitForTimeout(2000);
  const resultUrl = page.url();
  await page.close();

  console.log(`[tistory] 완료: ${resultUrl}`);
  return resultUrl;
}

/* ───────── 내부 헬퍼 ───────── */

async function inputTitle(page, title) {
  const sel = 'input[id*="title"], [placeholder*="제목을 입력"]';
  await page.waitForSelector(sel, { timeout: 15000 });
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
        // 첨부 버튼 (aria-label="첨부") 클릭
        const attachDiv = Array.from(document.querySelectorAll('[aria-label="첨부"]'))
          .find(el => el.offsetParent !== null);
        if (attachDiv) attachDiv.click();
        await new Promise(r => setTimeout(r, 400));
        // 사진 메뉴 아이템 클릭
        const photoItem = document.getElementById('attach-image');
        if (photoItem) photoItem.click();
      }),
    ]);
    await fileChooser.setFiles(absolutePath);
    await page.waitForTimeout(4000);

    // TinyMCE에서 [##_Image|...|CDM|버전|{json}_##] 템플릿 추출
    const template = await page.evaluate((desc) => {
      const ed = window.tinymce?.get('editor-tistory');
      if (!ed) return null;
      const content = ed.getContent();

      // 티스토리 이미지 템플릿 매칭
      const regex = /\[##_Image\|([^|]+)\|CDM\|([^|]+)\|(\{.*?\})_##\]/;
      const match = content.match(regex);
      if (!match) return null;

      let template = match[0];

      // caption 필드에 설명 주입
      if (desc) {
        try {
          const meta = JSON.parse(match[3]);
          meta.caption = desc;
          template = `[##_Image|${match[1]}|CDM|${match[2]}|${JSON.stringify(meta)}_##]`;
        } catch {
          template = template.replace(/"caption":"[^"]*"/, `"caption":"${desc.replace(/"/g, '\\"')}"`);
        }
      }

      // 에디터에서 제거 (나중에 setContent로 전체 주입)
      ed.setContent(content.replace(match[0], '').trim());

      return template;
    }, description || '');

    return template;
  } catch (err) {
    console.log(`[tistory] 이미지 업로드 오류: ${err.message}`);
    return null;
  }
}

async function inputHtmlContent(page, html) {
  await page.evaluate((html) => {
    const ed = window.tinymce?.get('editor-tistory');
    if (ed) ed.setContent(html);
  }, html);
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
    await page.click('#category-btn');
    await page.waitForTimeout(300);
    const option = page.locator(`[role="option"]:has-text("${category}"), li:has-text("${category}")`).first();
    await option.waitFor({ timeout: 3000 });
    await option.click();
    console.log(`[tistory] 카테고리 "${category}" 설정 완료`);
  } catch {
    console.log('[tistory] 카테고리 설정 스킵');
  }
}

async function saveDraft(page) {
  await page.evaluate(() => {
    document.querySelector('span.btn-draft a.action')?.click();
  });
  await page.waitForTimeout(1500);
  console.log('[tistory] 임시저장 완료');
}

async function publish(page) {
  await page.click('#publish-layer-btn');
  await page.waitForTimeout(500);
  // 발행 확인 팝업에서 발행 버튼 찾기
  try {
    const btn = page.locator('button:has-text("발행"), button:has-text("공개발행"), button:has-text("확인")').last();
    await btn.waitFor({ timeout: 5000 });
    await btn.click();
    console.log('[tistory] 발행 완료');
  } catch {
    console.log('[tistory] 발행 팝업 없음, 완료 처리');
  }
}
