import 'dotenv/config';
import { naverLogin, checkNaverSession } from './src/platforms/naver.js';
import { tistoryLogin, checkTistorySession, tistoryPost } from './src/platforms/tistory.js';
import { closeBrowser } from './src/core/browser.js';
import { loadTodayPost } from './src/content/loader.js';

const args = process.argv.slice(2);

async function main() {
  try {

    // --login naver | tistory | all
    const loginIdx = args.indexOf('--login');
    if (loginIdx !== -1) {
      await runLogin(args[loginIdx + 1]);
      return;
    }

    // --post tistory | naver | all
    const postIdx = args.indexOf('--post');
    if (postIdx !== -1) {
      await runPost(args[postIdx + 1]);
      return;
    }

    // --check
    if (args.includes('--check')) {
      await runCheck();
      return;
    }

    printHelp();

  } catch (err) {
    console.error('[error]', err.message);
    process.exit(1);
  } finally {
    await closeBrowser();
  }
}

async function runLogin(target) {
  if (!target || !['naver', 'tistory', 'all'].includes(target)) {
    console.log('사용법: node index.js --login [naver|tistory|all]');
    return;
  }
  if (target === 'naver'   || target === 'all') await naverLogin(true);
  if (target === 'tistory' || target === 'all') await tistoryLogin(true);
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
    console.log(`   태그: ${post.tags.join(', ')}`);
    console.log(`   이미지: ${post.images.length}개`);

    if (target === 'tistory') await tistoryPost(post);
    if (target === 'naver')   console.log('[naver] 포스팅은 Phase 3에서 구현 예정');
  }
}

async function runCheck() {
  console.log('=== 세션 상태 확인 ===');
  const naver   = await checkNaverSession();
  const tistory = await checkTistorySession();
  console.log(`네이버  : ${naver   ? '✓ 로그인됨' : '✗ 로그인 필요'}`);
  console.log(`티스토리: ${tistory ? '✓ 로그인됨' : '✗ 로그인 필요'}`);
}

function printHelp() {
  console.log('');
  console.log('사용법:');
  console.log('  node index.js --login [naver|tistory|all]   로그인 & 세션 저장');
  console.log('  node index.js --post  [tistory|naver|all]   오늘 글 포스팅');
  console.log('  node index.js --check                       세션 상태 확인');
  console.log('');
}

main();
