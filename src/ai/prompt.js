/**
 * Gemini 블로그 생성 프롬프트 빌더
 * seo_prompt.md 규칙을 코드로 내장
 */

import { CALCULATORS, CALCULATOR_GROUPS, COMPLETED_POSTS } from './calculators.js';

/** 그룹 내 완료된 포스팅 → 티스토리 내부 링크 목록 */
function buildInternalLinks(targetId) {
  const cal = CALCULATORS[targetId];
  if (!cal) return [];

  const group = CALCULATOR_GROUPS[cal.group];
  if (!group) return [];

  return COMPLETED_POSTS
    .filter(p => {
      const c = CALCULATORS[p.id];
      return c && c.group === cal.group && p.id !== targetId && p.tistory_no;
    })
    .map(p => ({
      no: p.tistory_no,
      url: `https://severa.tistory.com/${p.tistory_no}`,
      name: CALCULATORS[p.id].name,
    }));
}

/** 네이버 카테고리 조회 */
function getNaverCategory(targetId) {
  const cal = CALCULATORS[targetId];
  const group = CALCULATOR_GROUPS[cal?.group];
  return group?.naver_category || '지식·동향 > 생활정보';
}

/** 메인 프롬프트 생성 */
export function buildPrompt(targetId, today) {
  const cal = CALCULATORS[targetId];
  if (!cal) throw new Error(`알 수 없는 계산기 ID: ${targetId}`);

  const internalLinks = buildInternalLinks(targetId);
  const naverCategory = getNaverCategory(targetId);
  const year = today.slice(0, 4);
  const calUrl = `https://serenkit.com${cal.url}`;

  const internalLinksBlock = internalLinks.length > 0
    ? internalLinks.map(l => `- ${l.url} → "${l.name}"`).join('\n')
    : '(없음 — 내부 링크 섹션 생략)';

  return `당신은 네이버·티스토리 블로그 SEO 전문가이자 자연스러운 한국어 글쓰기 전문가입니다.
아래 규칙을 완벽하게 준수하여 serenkit.com의 "${cal.name}"에 대한 블로그 포스팅 3개 파일 내용을 생성하세요.

---

## 🎯 대상 계산기

- **이름:** ${cal.name}
- **URL:** ${calUrl}
- **설명:** ${cal.description}
- **결과 파라미터 예시:** ${calUrl}${cal.example_params}
- **오늘 날짜:** ${today}
- **연도:** ${year}

---

## ⛔ 절대 금지 — SEO·정책 규칙

1. "무료", "무료로 사용", "무료 제공" 등 '무료' 표현 — 구글 애드센스 정책 위반
2. "세렌킷" — 브랜드명은 반드시 영문 **serenkit**
3. HTML 이외 마크다운(##, **, _ 등) 본문 사용 금지 — 본문은 순수 HTML (bold는 반드시 <strong> 태그 사용)
4. 티스토리·네이버 제목 동일하게 작성 금지

---

## 🚫 절대 금지 — AI 투 말투 패턴 (위반 시 전체 재작성)

다음 표현은 AI가 생성한 것처럼 느껴지므로 절대 사용하지 마세요.

### 금지 표현 목록
- "완벽 가이드", "완벽 정리", "완벽 분석", "총정리" — 제목·본문 모두 금지
- "복잡한 계산 없이", "복잡한 공식 없이", "복잡한 과정 없이"
- "누구나 쉽게 사용할 수 있도록", "누구나 쉽게"
- "직관적인 인터페이스", "직관적인 UI"
- "스마트하게 관리", "효율적으로 관리"
- "매우 중요합니다", "매우 간단합니다", "매우 유용합니다"
- "~를 통해 이 모든 정보를 쉽고 빠르게 얻을 수 있습니다"
- "단순한 기능을 넘어 사용자에게 다양한 편의 기능을 제공합니다"
- "더욱 만족스러운 경험을 만드시길 바랍니다"
- 본문에 날짜 직접 언급 — "2026년, 이제 ~", "오늘 날짜는 ~" 금지
- 추천이유 섹션 앞 소개 문장 ("serenkit은 단순한 변환 도구를 넘어...") — 바로 ul 리스트로 시작
- FAQ 앞 도입 문장 ("자주 궁금해하는 질문들을 모아 답변해 드립니다" 등) — 바로 Q/A로 시작

### 금지 HTML 구조
- FAQ에 Q1/A1, Q2/A2 같은 번호 형식 — 번호 없이 Q./A. 사용
- 사용법 섹션에 \`<ol>\` 번호 리스트 — \`<ul>\`과 ✅ 아이콘으로 대체
- \`<dl><dt><dd>\` FAQ 구조 — \`<p><strong>Q. 질문</strong></p><p>답변</p>\` 형식으로 대체
- "1단계:", "2단계:", "3단계:" 같은 단계 제목 — 자연스러운 설명 문장으로 대체

---

## 🗣️ 자연스러운 말투 가이드

### 전체 톤
- 실제 사용자가 직접 써보고 경험을 공유하는 느낌으로 작성
- 구어체 자연스럽게 사용: ~어요, ~돼요, ~해요, ~거든요, ~더라고요
- 문장 길이를 다양하게: 짧은 문장과 긴 문장을 섞어서 리듬감 있게
- 모든 문장이 같은 구조로 끝나지 않도록 (단조로운 반복 금지)

### 도입부 작성법
- 독자가 실제로 겪는 상황을 구체적으로 묘사 (ex: "이사 준비하다가", "레시피 보다가", "직구할 때")
- 첫 문장은 질문형 또는 상황 묘사형으로
- 좋은 예: "이사 준비하다가 아파트 평수랑 제곱미터가 헷갈려서 검색해본 적 있으신가요?"
- 나쁜 예: "2026년, 복잡한 계산 없이 누구나 쉽게 사용할 수 있는 계산기를 소개합니다."

### FAQ 작성법
형식: 아래처럼 반드시 \`<p><strong>Q. 질문</strong></p>\` + \`<p>구어체 답변</p>\` 구조
\`\`\`html
<p><strong>Q. 질문 내용</strong></p>
<p>답변을 구어체로 자연스럽게. ~어요, ~돼요 말투 사용. 짧고 명확하게.</p>
\`\`\`
- 답변은 딱딱한 설명체 아닌 구어체로
- "~입니다" 끝맺음 대신 "~어요", "~해요" 사용

### 사용법 섹션 작성법
- \`<ol>\` 단계 나열 금지 → \`<ul>\`과 ✅ 로 항목 나열
- "1단계 ~, 2단계 ~" 패턴 금지 → 자연스러운 1~2 문장으로 설명
- 좋은 예: "항목을 다 채우고 '계산하기'를 누르면 결과가 바로 나와요."
- 나쁜 예: "1단계: 정보를 입력합니다. 2단계: 결과를 확인합니다."

---

## 📝 tistory.txt 규칙

### 상단 메타 형식 (반드시 이 형식 그대로)
\`\`\`
제목: [${year}] ${cal.name} — [핵심 기능/수치 포함 부제, 60자 이내, "완벽 가이드/정리" 금지]
카테고리: 생활정보
태그: #키워드1 #키워드2 ... (8~12개: 주요키워드 2개 + 롱테일 4개 + 연관키워드 3개 + #serenkit)
메타 디스크립션: (80~120자, 주요 키워드 포함, 자연스러운 구어체 2문장, "2026년" 시작 금지)
이미지 디스크립션:
- serenkit-input.png: (입력 화면 설명, 어떤 항목이 있는지)
- serenkit-result.png: (결과 화면 설명, 예시 수치 포함)
---
[HTML 본문]
\`\`\`

### 본문 구조 (순서 준수)

1. **도입부**
   - 첫 문장: 독자가 겪는 구체적인 상황을 묘사 (날짜 언급 없이)
   - 2~3줄 공감 문단 (구어체)
   - "이 글에서는 ... serenkit ${cal.name} 사용법까지 정리했습니다." 문장
   - serenkit 링크: \`<a href="${calUrl}" target="_blank" rel="noopener">\`

2. **📌 목차** (도입부 직후)
   \`\`\`html
   <br>
   <p>📌 이 글에서 다루는 내용</p>
   <ul>
   <li>...</li>
   </ul>
   \`\`\`

3. **개념 설명 H2** — 테이블/리스트로 정보 구조화

4. **계산 공식/방법 H2** — 테이블로 시각화

5. **💻 serenkit ${cal.name} 사용법 H2**
   - 도입 문장: 자연스럽게 1줄 (금지 표현 없이)
   - \`<p>[이미지: serenkit-input.png]</p>\`
   - 기능 설명: \`<ul>\`에 ✅ 아이콘으로 항목 나열 (\`<ol>\` 금지)
   - \`<p>[이미지: serenkit-result.png]</p>\`
   - 결과 설명 (예시 수치 언급, 구어체)

6. **✅ serenkit 계산기를 추천하는 이유 H2**
   - 섹션 도입 문장 없이 바로 \`<ul>\` 시작
   - 6~7개 항목, 형식: \`이모지 <strong>항목명</strong> — 설명 (~어요)\`
   - 반드시 포함: 🔗 결과 공유 기능, 💾 이미지 저장 기능, ⭐ 즐겨찾기 기능
   - 계산기 특성에 맞는 항목 추가

7. **🔗 함께 보면 좋은 글 H2** (티스토리 내부 링크)
   - 같은 그룹 완료 포스팅 연결:
${internalLinksBlock}
   - 링크가 없으면 이 섹션 생략

8. **❓ 자주 묻는 질문 H2** — 5~6개 Q&A, 실제 검색어 기반
   - 도입 문장 없이 바로 Q/A 시작
   - 형식: \`<p><strong>Q. 질문</strong></p><p>구어체 답변</p>\`
   - 번호(Q1/A1) 절대 금지

### H2 간격 규칙
모든 H2 앞에 반드시 \`<br>\` 1개:
\`\`\`html
<p>...이전 섹션 마지막 문단...</p>

<br>
<h2>이모지 섹션 제목</h2>
\`\`\`

### 이모지 규칙
- H2마다 이모지 1개 (📅🗓💻✅🔗❓ 등 섹션 성격에 맞게)
- 본문 전체 10~15개 이내
- 💡 팁/인사이트, 📌 목차에만 간헐적 사용

---

## 📝 naver.txt 규칙

\`\`\`
제목: (티스토리와 완전히 다른 제목, 구어체/질문형 권장, "2026년" 시작 금지, "완벽 가이드/정리" 금지)
주제: ${naverCategory}
태그: #태그1 ... (15~20개: 대형 3개 + 중형 5개 + 소형/롱테일 7개 + #serenkit)
이미지 디스크립션:
- serenkit-input.png: (입력 화면 설명)
- serenkit-result.png: (결과 화면 설명)
\`\`\`

---

## 📝 naver.html 규칙

### 본문 구조
1. **도입부** — 실제 사용 경험 기반의 자연스러운 첫 문장 + serenkit 링크 포함 (날짜 언급 없이)
2. **📌 목차** (도입부 직후)
3. **개념/공식 섹션** — H2 + 테이블
4. **💻 사용법 섹션** — 이미지 2장 + \`<ul>\` ✅ 항목 설명 (\`<ol>\`·단계 제목 금지)
5. **✅ 추천 이유 섹션** — 티스토리와 동일한 형식, 섹션 도입 문장 없이 바로 \`<ul>\`
6. **❓ FAQ 섹션** — 5개 Q/A, 도입 문장 없이 바로 시작, \`<p><strong>Q.</strong></p>\` 형식
7. **내부 링크 없음** — serenkit.com 링크만 유지

### 주의
- 네이버 본문은 광고성 문구 지양
- 1,500자 이상 충실하게 작성
- H2·개행·이모지 규칙은 티스토리와 동일
- AI 투 표현 금지 규칙 동일 적용

---

## 📤 출력 형식

아래 JSON 형식으로만 출력하세요. JSON 외 다른 텍스트 없이:

\`\`\`json
{
  "tistory_txt": "여기에 tistory.txt 전체 내용 (메타 + --- + HTML 본문)",
  "naver_txt": "여기에 naver.txt 전체 내용 (메타만)",
  "naver_html": "여기에 naver.html 전체 내용 (HTML 본문만)"
}
\`\`\`

JSON 내 줄바꿈은 \\n으로, 따옴표는 \\"로 이스케이프하세요.
`;
}
