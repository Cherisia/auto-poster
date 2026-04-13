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

  return `당신은 네이버·티스토리 블로그 SEO 전문가입니다.
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

## ⛔ 절대 금지

1. "무료", "무료로 사용", "무료 제공" 등 '무료' 표현 — 구글 애드센스 정책 위반
2. "세렌킷" — 브랜드명은 반드시 영문 **serenkit**
3. HTML 이외 마크다운(##, **, _ 등) 본문 사용 금지 — 본문은 순수 HTML
4. 티스토리·네이버 제목 동일하게 작성 금지

---

## 📝 tistory.txt 규칙

### 상단 메타 형식 (반드시 이 형식 그대로)
\`\`\`
제목: [${year}] ${cal.name} — [핵심 기능/수치 포함 부제, 60자 이내]
카테고리: 생활정보
태그: #키워드1 #키워드2 ... (8~12개: 주요키워드 2개 + 롱테일 4개 + 연관키워드 3개 + #serenkit)
메타 디스크립션: (80~120자, 주요 키워드 포함 2문장)
이미지 디스크립션:
- serenkit-input.png: (입력 화면 설명, 어떤 항목이 있는지)
- serenkit-result.png: (결과 화면 설명, 예시 수치 포함)
---
[HTML 본문]
\`\`\`

### 본문 구조 (순서 준수)

1. **도입부**
   - 첫 문장: 독자가 겪는 상황을 질문/묘사로 시작 (공감형 Hook)
   - 2~3줄 공감 문단
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
   - \`<p>[이미지: serenkit-input.png]</p>\`
   - 기능 설명 리스트 (✅ 아이콘)
   - \`<p>[이미지: serenkit-result.png]</p>\`
   - 결과 설명 (예시 수치 언급)

6. **✅ serenkit 계산기를 추천하는 이유 H2**
   - 6~7개 항목, 형식: \`이모지 <strong>항목명</strong> — 설명 (~어요)\`
   - 반드시 포함: 🔗 결과 공유 기능, 💾 이미지 저장 기능, ⭐ 즐겨찾기 기능
   - 계산기 특성에 맞는 항목 추가

7. **🔗 함께 보면 좋은 글 H2** (티스토리 내부 링크)
   - 같은 그룹 완료 포스팅 연결:
${internalLinksBlock}
   - 링크가 없으면 이 섹션 생략

8. **❓ 자주 묻는 질문 H2** — 5~6개 Q&A, 실제 검색어 기반

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
제목: (티스토리와 완전히 다른 제목, 구어체/질문형 가능)
주제: ${naverCategory}
태그: #태그1 ... (15~20개: 대형 3개 + 중형 5개 + 소형/롱테일 7개 + #serenkit)
이미지 디스크립션:
- serenkit-input.png: (입력 화면 설명)
- serenkit-result.png: (결과 화면 설명)
\`\`\`

---

## 📝 naver.html 규칙

### 본문 구조
1. **도입부** — 핵심 답변을 첫 문단에 바로 제시 (D.I.A. 직접성)
2. **📌 목차** (도입부 직후)
3. **개념/공식 섹션** — H2 + 테이블
4. **💻 사용법 섹션** — 이미지 2장 + 단계별 설명
5. **✅ 추천 이유 섹션** — 티스토리와 동일한 형식
6. **❓ FAQ 섹션** — 5개 Q&A
7. **내부 링크 없음** — serenkit.com 링크만 유지

### 주의
- 네이버 본문은 광고성 문구 지양
- 1,500자 이상 충실하게 작성
- H2·개행·이모지 규칙은 티스토리와 동일

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
