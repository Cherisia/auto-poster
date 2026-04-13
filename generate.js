/**
 * generate.js — Gemini AI 블로그 글 자동 생성
 *
 * 사용법:
 *   node generate.js                   # 큐에서 다음 계산기 자동 선택
 *   node generate.js date-add          # 특정 계산기 지정
 *   node generate.js --all             # 큐 전체 생성 (주의: API 할당량 소모)
 *
 * 환경변수:
 *   GEMINI_API_KEY  — Gemini API 키 (필수)
 *   BLOG_BASE       — 생성 파일 저장 경로 (기본: ./generated)
 */

import 'dotenv/config';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { generateContent } from './src/ai/generator.js';
import { buildPrompt }     from './src/ai/prompt.js';
import { POST_QUEUE, CALCULATORS, COMPLETED_POSTS } from './src/ai/calculators.js';

// ── 환경 변수 ────────────────────────────────────────────────────────────────

// API 키 우선순위 설정 (yhc2549 먼저 → yhc920923 백업)
const API_KEYS = [];
if (process.env.GEMINI_API_KEY)        API_KEYS.push({ key: process.env.GEMINI_API_KEY,        label: 'yhc2549(primary)' });
if (process.env.GEMINI_API_KEY_BACKUP) API_KEYS.push({ key: process.env.GEMINI_API_KEY_BACKUP, label: 'yhc920923(backup)' });

if (API_KEYS.length === 0) {
  console.error('[error] GEMINI_API_KEY 환경변수가 없습니다.');
  process.exit(1);
}

const BLOG_BASE = process.env.BLOG_BASE || join(process.cwd(), 'generated');

// ── 상태 파일 ────────────────────────────────────────────────────────────────

const STATE_FILE = join(process.cwd(), 'generate-state.json');

function loadState() {
  if (!existsSync(STATE_FILE)) return { generated: [] };
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf-8')); }
  catch { return { generated: [] }; }
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

// ── 날짜 유틸 ────────────────────────────────────────────────────────────────

function getToday() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getTodayCompact() {
  return getToday().replace(/-/g, '');
}

// ── 이미 생성됐는지 확인 ──────────────────────────────────────────────────────

function isAlreadyGenerated(calId, state) {
  const completedIds = COMPLETED_POSTS.map(p => p.id);
  if (completedIds.includes(calId)) return true;
  if (state.generated.includes(calId)) return true;
  return false;
}

// ── 단일 계산기 생성 ──────────────────────────────────────────────────────────

async function generateOne(calId) {
  const cal = CALCULATORS[calId];
  if (!cal) throw new Error(`알 수 없는 계산기 ID: ${calId}`);

  const today = getToday();
  const dateStr = getTodayCompact();

  console.log(`\n🚀 생성 시작: [${calId}] ${cal.name}`);
  console.log(`   날짜: ${today}`);

  // 프롬프트 빌드
  const prompt = buildPrompt(calId, today);

  // Gemini 호출 (yhc2549 우선 → yhc920923 폴백)
  const { tistory_txt, naver_txt, naver_html } = await generateContent(prompt, API_KEYS);

  // 출력 폴더 생성
  const outDir = join(BLOG_BASE, `${dateStr}-${calId}`);
  mkdirSync(outDir, { recursive: true });

  // 파일 저장
  writeFileSync(join(outDir, 'tistory.txt'), tistory_txt, 'utf-8');
  writeFileSync(join(outDir, 'naver.txt'),   naver_txt,   'utf-8');
  writeFileSync(join(outDir, 'naver.html'),  naver_html,  'utf-8');

  console.log(`\n✅ 저장 완료: ${outDir}`);
  console.log(`   tistory.txt  (${tistory_txt.length}자)`);
  console.log(`   naver.txt    (${naver_txt.length}자)`);
  console.log(`   naver.html   (${naver_html.length}자)`);

  return outDir;
}

// ── 메인 ─────────────────────────────────────────────────────────────────────

async function main() {
  const arg = process.argv[2];
  const state = loadState();

  // --all 모드: 큐 전체 순서대로 생성
  if (arg === '--all') {
    const pending = POST_QUEUE.filter(id => !isAlreadyGenerated(id, state));
    if (pending.length === 0) {
      console.log('✅ 모든 예정 포스팅이 이미 생성됐습니다.');
      return;
    }
    console.log(`📋 생성 예정: ${pending.join(', ')}`);
    for (const id of pending) {
      await generateOne(id);
      state.generated.push(id);
      saveState(state);
      // API 호출 간격 (rate limit 방지)
      await new Promise(r => setTimeout(r, 3000));
    }
    return;
  }

  // 특정 계산기 지정
  if (arg && arg !== '--all') {
    await generateOne(arg);
    if (!state.generated.includes(arg)) {
      state.generated.push(arg);
      saveState(state);
    }
    return;
  }

  // 기본: 큐에서 다음 계산기 자동 선택
  const nextId = POST_QUEUE.find(id => !isAlreadyGenerated(id, state));
  if (!nextId) {
    console.log('✅ 대기 중인 포스팅이 없습니다. POST_QUEUE를 확인하세요.');
    process.exit(0);
  }

  await generateOne(nextId);
  state.generated.push(nextId);
  saveState(state);
}

main().catch(err => {
  console.error('\n❌ 오류:', err.message);
  process.exit(1);
});
