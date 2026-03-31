import 'dotenv/config';
import { naverLogin, checkNaverSession } from './src/platforms/naver.js';
import { tistoryLogin, checkTistorySession } from './src/platforms/tistory.js';
import { closeBrowser } from './src/core/browser.js';

const args = process.argv.slice(2);

async function main() {
  try {
    // --login naver | tistory | all
    const loginIdx = args.indexOf('--login');
    if (loginIdx !== -1) {
      const target = args[loginIdx + 1];
      await runLogin(target);
      return;
    }

    // --check : 세션 상태 확인
    if (args.includes('--check')) {
      await runCheck();
      return;
    }

    // 기본 실행: 세션 상태 출력
    await runCheck();

  } catch (err) {
    console.error('[error]', err.message);
    process.exit(1);
  } finally {
    await closeBrowser();
  }
}

async function runLogin(target) {
  const force = true;

  if (target === 'naver' || target === 'all') {
    await naverLogin(force);
  }
  if (target === 'tistory' || target === 'all') {
    await tistoryLogin(force);
  }

  if (!target || !['naver', 'tistory', 'all'].includes(target)) {
    console.log('사용법: node index.js --login [naver|tistory|all]');
  }
}

async function runCheck() {
  console.log('=== 세션 상태 확인 ===');
  const naver = await checkNaverSession();
  const tistory = await checkTistorySession();

  console.log(`네이버  : ${naver ? '✓ 로그인됨' : '✗ 로그인 필요'}`);
  console.log(`티스토리: ${tistory ? '✓ 로그인됨' : '✗ 로그인 필요'}`);
  console.log('');
  console.log('로그인 명령어:');
  console.log('  npm run login:naver    — 네이버 로그인');
  console.log('  npm run login:tistory  — 티스토리 로그인');
  console.log('  npm run login:all      — 전체 로그인');
}

main();
