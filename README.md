# 🎉 auto-poster

 **블로그 자동 포스팅 도구**
 
 AI로 글을 생성하고, 이미지 캡처부터 예약 발행까지 전 과정을 자동화합니다.

---

## ✨ 주요 기능

- 🧠 **AI 글 생성** — Google Gemini API로 블로그 글(제목, 본문, 태그, 이미지 설명) 자동 작성
- 📸 **이미지 자동 캡처** — Puppeteer로 외부 사이트 스크린샷 캡처 후 포스트에 삽입
- 📝 **티스토리 자동화** — TinyMCE 에디터 본문 주입, 이미지 업로드, 캡션 자동 설정
- 📝 **네이버 자동화** — Smart Editor ONE(SE3) 복사, 붙여넣기, base64 이미지 직접 주입
- 📅 **발행 모드 선택** — 임시저장 / 즉시 발행 / 예약 발행(날짜, 시간 자동 설정)
- 🔁 **API 키 폴백** — Gemini 할당량 초과 시 백업 키로 자동 전환

---

## 🛠 기술 스택

| 분류 | 기술 |
|---|---|
| **Runtime** | Node.js 18+ (ESM) |
| **브라우저 자동화** | Playwright — `connectOverCDP` 방식으로 기존 크롬 세션 재사용 |
| **이미지 캡처** | Puppeteer — Headless Chrome |
| **AI 글 생성** | Google Gemini API (`gemini-2.0-flash`, 모델 폴백 지원) |
| **환경변수** | dotenv |

---

## 🏗 아키텍처

```
auto-poster/
├── 📄 index.js              # 포스팅 진입점 — 폴더 선택 메뉴 + 플랫폼 실행
├── 📄 generate.js           # AI 생성 진입점 — Gemini 호출 + 파일/이미지 저장
├── 📄 config.json           # 발행 모드, 블로그 URL/ID, Gemini 모델 설정
├── 📄 .env                  # API 키 (GEMINI_API_KEY, GEMINI_API_KEY_BACKUP)
└── src/
    ├── core/
    │   ├── browser.js       # Playwright CDP 연결 (connectOverCDP)
    │   └── config.js        # config.json 캐시 로더
    ├── content/
    │   └── loader.js        # 블로그 폴더 탐색 · txt/html 파싱 · 이미지 경로 추출
    ├── platforms/
    │   ├── tistory.js       # 티스토리 TinyMCE 에디터 자동화
    │   └── naver.js         # 네이버 SE3 에디터 자동화
    ├── ai/
    │   ├── generator.js     # Gemini API 호출 · JSON 파싱 · 모델 폴백
    │   ├── prompt.js        # 블로그 글 생성 프롬프트 빌더
    │   └── calculators.js   # 콘텐츠 주제 정의 · 발행 큐 관리
    └── capture/
        └── index.js         # Puppeteer 스크린샷 캡처
```

---

## 🍭 플로우

### 1️⃣ AI 글 생성 (`generate.js`)

```
┌─────────────────────────────────────────────┐
│  POST_QUEUE에서 미생성 주제 선택              │
└────────────────────┬────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│  buildPrompt() → Gemini API 호출            │
│  (할당량 초과 시 백업 키로 자동 폴백)          │
└────────────────────┬────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│  tistory.txt · naver.txt · naver.html 저장  │
└────────────────────┬────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│  Puppeteer → serenkit 페이지 스크린샷 캡처   │
│  (serenkit-input.png · serenkit-result.png) │
└────────────────────┬────────────────────────┘
                     ↓
┌─────────────────────────────────────────────┐
│  generate-state.json 업데이트               │
└─────────────────────────────────────────────┘
```

---

### 2️⃣ 포스팅 자동화 (`index.js`)

```
start-chrome.bat → CDP 포트 9222로 크롬 실행
(사용자가 직접 티스토리 · 네이버 로그인)
                     ↓
블로그 폴더 선택 (YYYYMMDD-title/)
                     ↓
loader.js → txt 파싱
(제목 · 카테고리 · 태그 · 이미지 플레이스홀더 추출)
                     ↓
         ┌───────────┴───────────┐
         ▼                       ▼
  ┌─── 티스토리 ───┐      ┌─── 네이버 ────┐
  │ TinyMCE       │      │ temp HTML 생성 │
  │ .setContent() │      │ Ctrl+A+C →    │
  │ 로 본문 주입   │      │ SE3에 Ctrl+V  │
  │               │      │               │
  │ filechooser   │      │ base64 →      │
  │ 인터셉트 →    │      │ DataTransfer  │
  │ 이미지 업로드  │      │ → 직접 주입   │
  │               │      │               │
  │ 이미지 캡션   │      │ 태그 · 주제   │
  │ 템플릿 주입   │      │ 발행 패널 설정 │
  └──────┬────────┘      └──────┬────────┘
         └───────────┬───────────┘
                     ↓
         draft / publish / schedule 모드로 저장
```

---

## ⚙️ 발행 모드

`config.json`에서 플랫폼별로 개별 설정합니다.

```json
{
  "tistory": { "mode": "draft",    "scheduleTime": "20:00" },
  "naver":   { "mode": "schedule", "scheduleTime": "20:00" }
}
```

| mode | 동작 |
|---|---|
| `draft` | 임시저장 |
| `publish` | 즉시 발행 |
| `schedule` | 다음날 `scheduleTime` 시각 예약 발행 |

---

## 📁 콘텐츠 폴더 구조

```
BLOG_BASE/
└── 20260414-salary/
    ├── tistory.txt          # 메타(제목·카테고리·태그·이미지설명) + 본문 HTML
    ├── naver.txt            # 네이버용 메타 + 본문 HTML
    ├── naver.html           # 네이버 본문 HTML (있으면 txt 본문 대체)
    ├── serenkit-input.png   # 캡처된 입력 화면 이미지
    └── serenkit-result.png  # 캡처된 결과 화면 이미지
```

**txt 파일 포맷**

```
제목: 포스트 제목
카테고리: 생활정보
태그: #tag1 #tag2 #tag3
이미지 디스크립션:
- serenkit-input.png: 입력 화면 설명
---
<p>본문 HTML</p>
<p>[이미지: serenkit-input.png]</p>
```

`[이미지: filename]` placeholder는 `loader.js`가 파싱하여 실제 이미지 업로드 위치로 매핑합니다.

---

