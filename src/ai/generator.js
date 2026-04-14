/**
 * Gemini API를 사용한 블로그 글 생성기
 *
 * 호출 전략: [API 키 우선순위] × [모델 폴백] 조합
 *   1. primary 키 + config.json의 gemini.model 또는 기본 모델
 *   2. primary 키 + 다음 모델들 (할당량 초과 시)
 *   3. backup 키 + 동일한 모델 순서
 */
import { readConfig } from '../core/config.js';

// 우선순위 순서로 시도할 모델 목록 (무료 티어 지원)
const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
];

function getGeminiModels() {
  // config.json의 gemini.model 우선, 없으면 폴백 목록 첫 번째 사용
  const preferred = readConfig().gemini?.model?.trim();
  if (!preferred) return FALLBACK_MODELS;
  // 지정 모델을 맨 앞에, 나머지는 중복 제거 후 이어 붙임
  return [preferred, ...FALLBACK_MODELS.filter(m => m !== preferred)];
}

function getModels() {
  return getGeminiModels();
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Gemini API 호출 (단일 모델)
 */
async function callGeminiModel(prompt, apiKey, model) {
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    const errData = JSON.parse(err.match(/\{[\s\S]*\}/)?.[0] || '{}');
    const code = errData?.error?.code || res.status;
    throw Object.assign(new Error(`Gemini API 오류 (${code}): ${model}`), { code, raw: err });
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini 응답에 텍스트가 없습니다.');
  return text;
}

/**
 * 단일 API 키로 모델 폴백 시도
 * 429(할당량 초과) 시 다음 모델로 전환, 그 외 오류는 즉시 throw
 * @returns {Promise<string>} 성공 시 응답 텍스트, 전 모델 실패 시 throw
 */
async function callGeminiWithKey(prompt, apiKey, keyLabel) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  for (const model of getModels()) {
    console.log(`  → [${keyLabel}] ${model} 시도`);
    let lastErr;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const text = await callGeminiModel(prompt, apiKey, model);
        console.log(`  ✓ [${keyLabel}] ${model} 성공`);
        return text;
      } catch (e) {
        lastErr = e;
        if (e.code === 429) {
          if (attempt < 2) {
            console.log(`  ⚠️  [${keyLabel}] 할당량 초과 (${model}) — 15초 후 재시도...`);
            await sleep(15000);
          } else {
            console.log(`  ✗ [${keyLabel}] 할당량 소진: ${model} — 다음 모델로`);
          }
        } else {
          console.log(`  ✗ [${keyLabel}] 오류: ${e.message}`);
          break;
        }
      }
    }
  }
  throw Object.assign(new Error(`[${keyLabel}] 모든 모델 할당량 소진`), { code: 429 });
}

/**
 * Gemini API 호출 — API 키 우선순위 + 모델 폴백
 * @param {string} prompt
 * @param {string[]} apiKeys - [우선키, 백업키, ...] 순서
 * @returns {Promise<string>} 응답 텍스트
 */
async function callGemini(prompt, apiKeys) {
  const keys = Array.isArray(apiKeys) ? apiKeys : [apiKeys];

  for (let i = 0; i < keys.length; i++) {
    const { key, label } = keys[i];
    try {
      return await callGeminiWithKey(prompt, key, label);
    } catch (e) {
      if (e.code === 429 && i < keys.length - 1) {
        console.log(`\n  ⚡ [${label}] 전체 소진 → 다음 계정으로 전환\n`);
      } else {
        throw e;
      }
    }
  }
  throw new Error('모든 API 키 할당량 소진');
}

/**
 * JSON 파싱 (```json ... ``` 블록 처리)
 */
function parseJsonResponse(text) {
  // ```json ... ``` 블록 제거
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // JSON 블록만 추출 시도
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`JSON 파싱 실패: ${e.message}\n원문: ${text.slice(0, 300)}`);
  }
}

/**
 * 블로그 콘텐츠 생성
 * @param {string} prompt - buildPrompt()로 생성된 프롬프트
 * @param {Array<{key:string, label:string}>} apiKeys - API 키 우선순위 배열
 * @returns {Promise<{tistory_txt: string, naver_txt: string, naver_html: string}>}
 */
export async function generateContent(prompt, apiKeys) {
  console.log('  → Gemini API 호출 중...');
  const raw = await callGemini(prompt, apiKeys);

  console.log('  → 응답 파싱 중...');
  const result = parseJsonResponse(raw);

  const { tistory_txt, naver_txt, naver_html } = result;
  if (!tistory_txt || !naver_txt || !naver_html) {
    throw new Error(`필수 필드 누락: ${JSON.stringify(Object.keys(result))}`);
  }

  return { tistory_txt, naver_txt, naver_html };
}
