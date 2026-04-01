import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const BLOG_BASE = 'C:/Users/user/OneDrive/바탕 화면/희찬/blog';

/**
 * 오늘 날짜 디렉토리 경로 반환 (YYYYMMDD 형식)
 */
function getTodayDir() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm   = String(today.getMonth() + 1).padStart(2, '0');
  const dd   = String(today.getDate()).padStart(2, '0');
  const dirPath = join(BLOG_BASE, `${yyyy}${mm}${dd}`);

  if (!existsSync(dirPath)) {
    throw new Error(`오늘 날짜 디렉토리가 없습니다: ${dirPath}`);
  }
  return dirPath;
}

/**
 * txt 파일 헤더 파싱
 * 제목: ...
 * 카테고리: ... (티스토리) / 주제: ... (네이버)
 * 태그: #tag1 #tag2
 * ---
 * [HTML 본문]
 */
function parseTxt(raw) {
  const [headerPart, ...bodyParts] = raw.split(/\n---\n/);
  const body = bodyParts.join('\n---\n').trim();

  const meta = {};
  for (const line of headerPart.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key   = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    meta[key] = value;
  }

  // 태그: #tag1 #tag2 → ['tag1', 'tag2']
  const tags = (meta['태그'] || '').match(/#[^\s#]+/g)?.map(t => t.slice(1)) || [];

  return {
    title:       meta['제목'] || '',
    category:    meta['카테고리'] || meta['주제'] || '',
    tags,
    contentHtml: body,
  };
}

/**
 * HTML 본문에서 이미지 플레이스홀더 추출
 * <p>[이미지: filename.png]</p>
 * → [{ placeholder, filename, absolutePath }]
 */
function extractImagePlaceholders(html, dirPath) {
  const regex = /<p>\[이미지:\s*([^\]]+)\]<\/p>/g;
  const result = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const filename = match[1].trim();
    result.push({
      placeholder:  match[0],
      filename,
      absolutePath: join(dirPath, filename),
    });
  }
  return result;
}

/**
 * 플랫폼에 맞는 txt 파일 로드
 * @param {'tistory'|'naver'} platform
 * @returns { title, category, tags, contentHtml, images, dirPath }
 */
export function loadTodayPost(platform) {
  const dirPath = getTodayDir();
  const txtFile = join(dirPath, `${platform}.txt`);

  if (!existsSync(txtFile)) {
    throw new Error(`파일이 없습니다: ${txtFile}`);
  }

  const raw = readFileSync(txtFile, 'utf-8');
  const { title, category, tags, contentHtml } = parseTxt(raw);

  return {
    title,
    category,
    tags,
    contentHtml,
    images: extractImagePlaceholders(contentHtml, dirPath),
    dirPath,
  };
}
