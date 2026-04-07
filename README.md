# auto-poster

티스토리 · 네이버 블로그 자동 포스팅 도구

글 내용을 텍스트 파일로 준비해두면, 배치 파일 실행 한 번으로 제목·본문·이미지·태그·카테고리를 자동으로 입력하고 저장 또는 예약 발행까지 처리합니다.

---

## 요구사항

- Node.js 18+
- Google Chrome
- 티스토리 / 네이버 블로그 계정

---

## 설치

```bash
git clone https://github.com/yourname/auto-poster.git
cd auto-poster
npm install
npx playwright install chromium
```

---

## 초기 설정

### 1. 환경변수 설정

`.env` 파일을 작성합니다.

```env
TISTORY_BLOG_URL=https://your-blog.tistory.com/
NAVER_BLOG_ID=your_naver_id
BLOG_BASE=C:/Users/user/blog
ANTHROPIC_API_KEY=your_api_key   # AI 글 생성 시 필요
```

### 2. 발행 모드 설정

`config.json` 에서 플랫폼별 모드를 지정합니다.

```json
{
  "tistory": {
    "mode": "draft",
    "scheduleTime": "10:00"
  },
  "naver": {
    "mode": "schedule",
    "scheduleTime": "10:00"
  }
}
```

| mode | 동작 |
|---|---|
| `draft` | 임시저장 |
| `publish` | 즉시 발행 |
| `schedule` | 다음날 `scheduleTime` 시각에 예약 발행 |

---

## 글 폴더 구조

`BLOG_BASE` 아래에 `YYYYMMDD` 또는 `YYYYMMDD-이름` 형식으로 폴더를 만들고 파일을 준비합니다.

```
BLOG_BASE/
└── 20240601-my-post/
    ├── tistory.txt       # 티스토리용 메타데이터 + 본문
    ├── naver.txt         # 네이버용 메타데이터 + 본문
    ├── naver.html        # (선택) 네이버 본문 HTML - 있으면 txt 본문 대체
    ├── thumbnail.png
    └── screenshot.jpg
```

### txt 파일 포맷

```
제목: 공급가액 계산 방법 완전 정리
카테고리: IT·컴퓨터
태그: #부가세 #VAT계산 #공급가액
이미지 디스크립션:
- thumbnail.png: 공급가액 계산 화면 예시
- screenshot.jpg: 결과 화면
---
<p>본문 내용을 HTML로 작성합니다.</p>
<p>[이미지: thumbnail.png]</p>
<p>이미지 아래 이어지는 내용...</p>
<p>[이미지: screenshot.jpg]</p>
```

- `이미지 디스크립션` 블록: 이미지별 캡션 텍스트 (티스토리 캡션, 네이버 설명)
- `[이미지: 파일명]` : 본문 내 이미지 삽입 위치 플레이스홀더
- 구분선(`---`) 위는 메타데이터, 아래는 본문

---

## 사용법

### 1단계 — 크롬 실행 및 로그인

```
start-chrome.bat
```

별도 프로필로 크롬이 열리고 티스토리·네이버 로그인 페이지가 자동으로 뜹니다.
두 사이트에 로그인해두면 이후 재실행 시 로그인 상태가 유지됩니다.

### 2단계 — 포스팅 실행

```
post-tistory.bat     ← 티스토리
post-naver.bat       ← 네이버
```

글 폴더 목록이 나타나면 번호를 입력해 선택합니다.

```
========================================
  블로그 글 선택
========================================
   1. 20240602-vat-guide
   2. 20240601-my-post
----------------------------------------
번호 선택 (1~2): 1
```

이후 자동으로 제목·본문·이미지·태그를 입력하고 설정된 모드로 저장합니다.

---

## 파일 설명

| 파일 | 설명 |
|---|---|
| `start-chrome.bat` | CDP 디버깅 포트(9222)로 크롬 실행 |
| `post-tistory.bat` | 티스토리 포스팅 실행 |
| `post-naver.bat` | 네이버 포스팅 실행 |
| `index.js` | 메인 진입점 (메뉴 + 포스팅 실행) |
| `config.json` | 발행 모드·예약 시간 설정 |
| `.env` | 블로그 URL·ID·경로 설정 |
| `src/platforms/tistory.js` | 티스토리 자동화 로직 |
| `src/platforms/naver.js` | 네이버 자동화 로직 |
| `src/content/loader.js` | 글 폴더 탐색 및 파일 파싱 |
| `src/core/browser.js` | Playwright CDP 연결 |

---

## 문제 해결

**`start-chrome.bat 을 먼저 실행하고...` 오류**
→ `start-chrome.bat` 을 실행하고 로그인 후 다시 시도

**카테고리/주제 설정 스킵**
→ txt 파일의 카테고리명이 블로그에 등록된 이름과 정확히 일치하는지 확인

**이미지 업로드 실패**
→ 이미지 파일명이 txt 파일의 `이미지 디스크립션` 및 `[이미지: ...]` 플레이스홀더와 일치하는지 확인
