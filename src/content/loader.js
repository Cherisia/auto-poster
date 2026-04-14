import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import { readConfig } from '../core/config.js';

/* ───────── 폴더 탐색 ───────── */

/**
 * BLOG_DIR 환경변수 → 직접 지정 폴더
 * 없으면 config.json의 blog.base_path 에서 오늘 날짜(YYYYMMDD) 폴더, 없으면 가장 최근 폴더
 */
function resolveDir() {
  const basePath = readConfig().blog.base_path;
  if (!basePath) throw new Error('config.json 에 blog.base_path 경로가 없습니다.');
  if (process.env.BLOG_DIR) return process.env.BLOG_DIR;

  const dirs = readdirSync(basePath)
    .filter(f => /^\d{8}/.test(f))
    .sort()
    .reverse();

  if (dirs.length === 0) throw new Error(`블로그 폴더가 없습니다: ${basePath}`);

  const today = new Date();
  const prefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const todayDir = dirs.find(f => f.startsWith(prefix));

  if (!todayDir) console.log(`[loader] 오늘 폴더 없음 → 최근 폴더 사용: ${dirs[0]}`);
  return join(basePath, todayDir || dirs[0]);
}

/**
 * YYYYMMDD 형식 폴더 목록 (최신순)
 */
export function listBlogDirs() {
  const basePath = readConfig().blog.base_path;
  if (!basePath) throw new Error('config.json 에 blog.base_path 경로가 없습니다.');
  return readdirSync(basePath)
    .filter(f => /^\d{8}/.test(f))
    .sort()
    .reverse()
    .map(name => ({ name, path: join(basePath, name) }));
}

/* ───────── txt 파싱 ───────── */

/**
 * txt 파일 헤더 파싱
 *
 * 제목: ...
 * 카테고리: ... (티스토리) / 주제: ... (네이버)
 * 태그: #tag1 #tag2
 * 이미지 디스크립션:
 * - filename.png: 설명 텍스트
 * ---
 * [HTML 본문]
 */
function parseTxt(raw) {
  const [headerPart, ...bodyParts] = raw.split(/\n---\n/);
  const body = bodyParts.join('\n---\n').trim();

  const meta = {};
  const imageDescriptions = {};
  let inImageDesc = false;

  for (const line of headerPart.split('\n')) {
    if (line.trim() === '이미지 디스크립션:') {
      inImageDesc = true;
      continue;
    }
    if (inImageDesc) {
      const m = line.match(/^-\s*([^:]+):\s*(.+)/);
      if (m) {
        imageDescriptions[m[1].trim()] = m[2].trim();
      } else if (line.trim() && !line.startsWith('-')) {
        inImageDesc = false;
      }
      continue;
    }
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    meta[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
  }

  const tags = (meta['태그'] || '').match(/#[^\s#]+/g)?.map(t => t.slice(1)) || [];

  return {
    title:             meta['제목'] || '',
    category:          meta['카테고리'] || meta['주제'] || '',
    tags,
    contentHtml:       body,
    imageDescriptions,
  };
}

/* ───────── 이미지 플레이스홀더 ───────── */

/**
 * HTML 본문에서 [이미지: filename] 플레이스홀더 추출
 * <p>[이미지: filename.png]</p>
 */
function extractImagePlaceholders(html, dirPath) {
  const regex = /<p>\[이미지:\s*([^\]]+)\]<\/p>/g;
  const result = [];
  let m;
  while ((m = regex.exec(html)) !== null) {
    const filename = m[1].trim();
    result.push({
      placeholder:  m[0],
      filename,
      absolutePath: join(dirPath, filename),
    });
  }
  return result;
}

/* ───────── 포스트 로드 ───────── */

/**
 * 플랫폼에 맞는 포스트 파일 로드
 * platform.html 이 있으면 본문으로 우선 사용 (네이버용)
 *
 * @param {'tistory'|'naver'} platform
 * @returns {{ title, category, tags, contentHtml, images, dirPath }}
 */
export function loadTodayPost(platform) {
  const dirPath = resolveDir();
  const txtFile = join(dirPath, `${platform}.txt`);

  if (!existsSync(txtFile)) throw new Error(`파일이 없습니다: ${txtFile}`);

  const { title, category, tags, contentHtml: txtBody, imageDescriptions } = parseTxt(
    readFileSync(txtFile, 'utf-8')
  );

  const htmlFile = join(dirPath, `${platform}.html`);
  const bodyHtml = existsSync(htmlFile) ? readFileSync(htmlFile, 'utf-8') : txtBody;

  const images = extractImagePlaceholders(bodyHtml, dirPath).map(img => ({
    ...img,
    description: imageDescriptions[img.filename] || img.filename,
  }));

  return { title, category, tags, contentHtml: bodyHtml, images, dirPath };
}

/* ───────── 유틸 ───────── */

/**
 * 이미지 파일을 base64 data URI로 변환
 */
export function imageToDataUri(absolutePath) {
  const ext  = extname(absolutePath).slice(1).toLowerCase();
  const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }[ext] || 'image/png';
  return `data:${mime};base64,${readFileSync(absolutePath).toString('base64')}`;
}
