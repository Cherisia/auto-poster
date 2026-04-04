import 'dotenv/config';
import readline from 'readline';
import { listBlogDirs } from './src/content/loader.js';
import { tistoryPost } from './src/platforms/tistory.js';
import { naverPost }   from './src/platforms/naver.js';
import { loadTodayPost } from './src/content/loader.js';

const args = process.argv.slice(2);
const platform = args[0] || 'tistory';

async function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  const dirs = listBlogDirs();

  if (dirs.length === 0) {
    console.log('블로그 폴더가 없습니다.');
    process.exit(1);
  }

  console.log('');
  console.log('========================================');
  console.log('  블로그 글 선택');
  console.log('========================================');
  dirs.forEach((d, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${d.name}`);
  });
  console.log('----------------------------------------');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const input = await ask(rl, `번호 선택 (1~${dirs.length}): `);
  rl.close();

  const idx = parseInt(input.trim(), 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= dirs.length) {
    console.log('잘못된 번호입니다.');
    process.exit(1);
  }

  const selected = dirs[idx];
  console.log(`\n선택: ${selected.name}`);
  process.env.BLOG_DIR = selected.path;

  const post = loadTodayPost(platform);
  console.log(`\n📄 "${post.title}"`);
  console.log(`   카테고리: ${post.category}`);
  console.log(`   태그: ${post.tags.join(', ')}`);
  console.log(`   이미지: ${post.images.length}개`);
  console.log('');

  if (platform === 'tistory') {
    await tistoryPost(post);
  } else if (platform === 'naver') {
    await naverPost(post);
  } else {
    console.log(`[error] 지원하지 않는 플랫폼: ${platform}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[error]', err.message);
  process.exit(1);
});
