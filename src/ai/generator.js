/**
 * Gemini API를 사용한 블로그 글 생성기
 */

// 우선순위 순서로 시도할 모델 목록 (무료 티어 지원)
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
];
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
 * Gemini API 호출 — 모델 폴백 + 재시도 포함
 * @param {string} prompt
 * @param {string} apiKey
 * @returns {Promise<string>} 응답 텍스트
 */
async function callGemini(prompt, apiKey) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  for (const model of GEMINI_MODELS) {
    console.log(`  → 모델 시도: ${model}`);
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const text = await callGeminiModel(prompt, apiKey, model);
        console.log(`  ✓ 모델 성공: ${model}`);
        return text;
      } catch (e) {
        lastErr = e;
        if (e.code === 429) {
          // rate limit: 다음 시도 전 대기 (15s, 30s)
          const waitSec = attempt * 15;
          if (attempt < 3) {
            console.log(`  ⚠️  할당량 초과 (${model}) — ${waitSec}초 후 재시도...`);
            await sleep(waitSec * 1000);
          } else {
            console.log(`  ✗ 할당량 소진: ${model} — 다음 모델로 전환`);
          }
        } else {
          console.log(`  ✗ 오류: ${e.message}`);
          break; // 429 외 오류는 같은 모델 재시도 불필요
        }
      }
    }
    // 마지막 모델까지 실패 시 에러 누적
    if (model === GEMINI_MODELS.at(-1)) throw lastErr;
  }
  throw new Error('모든 Gemini 모델 호출 실패');
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
 * @param {string} apiKey - Gemini API 키
 * @returns {Promise<{tistory_txt: string, naver_txt: string, naver_html: string}>}
 */
export async function generateContent(prompt, apiKey) {
  console.log('  → Gemini API 호출 중...');
  const raw = await callGemini(prompt, apiKey);

  console.log('  → 응답 파싱 중...');
  const result = parseJsonResponse(raw);

  const { tistory_txt, naver_txt, naver_html } = result;
  if (!tistory_txt || !naver_txt || !naver_html) {
    throw new Error(`필수 필드 누락: ${JSON.stringify(Object.keys(result))}`);
  }

  return { tistory_txt, naver_txt, naver_html };
}
