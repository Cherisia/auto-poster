import 'dotenv/config';
import readline from 'readline';
import { listBlogDirs, loadTodayPost } from './src/content/loader.js';
import { tistoryPost } from './src/platforms/tistory.js';
import { naverPost }   from './src/platforms/naver.js';

const PLATFORMS = ['tistory', 'naver'];

/* ───────── 폴더 선택 메뉴 ───────── */

async function selectDir() {
  const dirs = listBlogDirs();
  if (dirs.length === 0) throw new Error('블로그 폴더가 없습니다.');

  console.log('\n========================================');
  console.log('  블로그 글 선택');
  console.log('========================================');
  dirs.forEach((d, i) => console.log(`  ${String(i + 1).padStart(2)}. ${d.name}`));
  console.log('----------------------------------------');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(resolve => rl.question(`번호 선택 (1~${dirs.length}): `, resolve));
  rl.close();

  const idx = parseInt(answer.trim(), 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= dirs.length) {
    throw new Error('잘못된 번호입니다.');
  }
  return dirs[idx];
}

/* ───────── 포스팅 실행 ───────── */

async function runPost(platform) {
  const targets = platform === 'all' ? PLATFORMS : [platform];

  const selected = await selectDir();
  console.log(`\n선택: ${selected.name}`);
  process.env.BLOG_DIR = selected.path;

  for (const target of targets) {
    const post = loadTodayPost(target);
    console.log(`\n📄 [${target}] "${post.title}"`);
    console.log(`   카테고리: ${post.category}`);
    console.log(`   태그: ${post.tags.join(', ')}`);
    console.log(`   이미지: ${post.images.length}개\n`);

    if (target === 'tistory') await tistoryPost(post);
    if (target === 'naver')   await naverPost(post);
  }
}

/* ───────── 진입점 ───────── */

async function main() {
  const platform = process.argv[2];

  if (!platform || !['tistory', 'naver', 'all'].includes(platform)) {
    console.log('\n사용법: node index.js [tistory|naver|all]');
    console.log('\n  post.bat            티스토리 포스팅');
    console.log('  post-naver.bat      네이버 포스팅\n');
    process.exit(1);
  }

  await runPost(platform);
}

main().catch(err => {
  console.error('[error]', err.message);
  process.exit(1);
});
