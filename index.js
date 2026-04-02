import 'dotenv/config';
import { tistoryPost } from './src/platforms/tistory.js';
import { naverPost } from './src/platforms/naver.js';
import { loadTodayPost } from './src/content/loader.js';

const args = process.argv.slice(2);

async function main() {
  try {

    // --post tistory | naver | all
    const postIdx = args.indexOf('--post');
    if (postIdx !== -1) {
      await runPost(args[postIdx + 1]);
      return;
    }

    printHelp();

  } catch (err) {
    console.error('[error]', err.message);
    process.exit(1);
  }
}

async function runPost(platform) {
  if (!platform || !['tistory', 'naver', 'all'].includes(platform)) {
    console.log('사용법: node index.js --post [tistory|naver|all]');
    return;
  }

  const targets = platform === 'all' ? ['tistory', 'naver'] : [platform];

  for (const target of targets) {
    const post = loadTodayPost(target);
    console.log(`\n📄 [${target}] "${post.title}"`);
    console.log(`   카테고리: ${post.category}`);
    console.log(`   태그: ${post.tags.join(', ')}`);
    console.log(`   이미지: ${post.images.length}개`);

    if (target === 'tistory') await tistoryPost(post);
    if (target === 'naver')   await naverPost(post);
  }
}

function printHelp() {
  console.log('');
  console.log('사용법:');
  console.log('  node index.js --post [tistory|naver|all]');
  console.log('');
  console.log('준비:');
  console.log('  1. start-chrome.bat 으로 크롬 실행');
  console.log('  2. 티스토리 로그인');
  console.log('  3. node index.js --post tistory');
  console.log('');
}

main();
