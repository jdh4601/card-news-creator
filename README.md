# 카드뉴스 생성기 (Card News Creator)

AI-powered Instagram card news generator - 원문 텍스트와 사진 6장을 업로드하면 AI가 인스타그램 카드뉴스 PNG 6장을 자동으로 생성합니다.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Express](https://img.shields.io/badge/Express-4.x-blue)
![Kimi](https://img.shields.io/badge/Kimi-Moonshot-blueviolet)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 🎯 주요 기능

- **AI 컨텐츠 생성**: Claude AI가 원문을 분석하여 카드뉴스용 제목과 본문을 자동 생성
- **드래그앤드롭 업로드**: 사진 6장을 쉽게 업로드
- **실시간 미리보기**: 각 페이지별 컨텐츠 검토 및 승인
- **PNG 자동 생성**: HTML → PNG 변환 (2160×2700px Retina 해상도)
- **ZIP 다운로드**: 완성된 6장의 카드뉴스를 한 번에 다운로드

## 🚀 빠른 시작

### 1. 설치

```bash
# 저장소 클론
git clone https://github.com/jdh4601/card-news-creator.git
cd card-news-creator

# 의존성 설치
npm install
```

### 2. 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열어 `KIMI_API_KEY`를 설정하세요:

```env
KIMI_API_KEY=sk-kimi-xxxxxxxxxxxx
PORT=3000
BASE_DIR=/your/path/card-news-creator
```

> **Kimi API Key 발급**: https://platform.moonshot.cn/

### 3. 서버 실행

```bash
# 개발 모드 (auto-reload)
npm run dev

# 프로덕션 모드
npm start
```

서버가 `http://localhost:3000`에서 실행됩니다.

### 4. 브라우저에서 접속

1. http://localhost:3000 접속
2. 사진 6장 업로드 (또는 드래그앤드롭)
3. 원문 텍스트 입력
4. "컨텐츠 생성 시작" 클릭
5. AI가 생성한 내용 검토 및 승인
6. ZIP 파일 다운로드

## 📁 디렉토리 구조

```
card-news-creator/
├── server.js                    # Express 서버
├── package.json                 # 프로젝트 설정
├── .env                         # 환경변수
├── .env.example                 # 환경변수 템플릿
├── lib/                         # 핵심 라이브러리
│   ├── set-manager.js          # 세트 ID 관리, 파일 조작
│   ├── claude-client.js        # Kimi (Moonshot) API 연동
│   ├── html-builder.js         # HTML 템플릿 빌더
│   └── capture.js              # Playwright PNG 캡처
├── public/                      # 프론트엔드 SPA
│   ├── index.html              # 메인 페이지
│   ├── style.css               # 스타일시트
│   └── app.js                  # 프론트엔드 로직
├── prompts/                     # AI 프롬프트
│   └── content-generation.md   # 브랜드 보이스 설정
├── scripts/                     # 유틸리티 스크립트
│   └── capture.mjs             # CLI 캡처 도구
├── input/                       # 업로드된 파일 저장소
│   └── {0001}/                 # 세트별 폴더
│       ├── photo-1.jpg
│       ├── ...
│       ├── photo-6.jpg
│       ├── text.md
│       └── session.json
├── output/                      # 생성된 결과물
│   └── {0001}/
│       ├── card-01.html
│       ├── ...
│       ├── card-06.html
│       ├── card-01.png
│       └── ...
└── template_*.html             # 카드 템플릿
```

## 🔌 API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | 서버 상태 확인 |
| POST | `/api/sets` | 새 세트 ID 발급 |
| POST | `/api/sets/:id/upload` | 사진 6장 + 텍스트 업로드 |
| POST | `/api/sets/:id/generate` | AI 컨텐츠 생성 |
| POST | `/api/sets/:id/build` | HTML 파일 생성 |
| POST | `/api/sets/:id/capture` | PNG 캡처 |
| GET | `/api/sets/:id/download` | ZIP 파일 다운로드 |
| GET | `/api/sets/:id/images/:filename` | 이미지 프리뷰 |

### API 사용 예시

```bash
# 세트 생성
curl -X POST http://localhost:3000/api/sets
# → {"id":"0001"}

# 파일 업로드
curl -X POST http://localhost:3000/api/sets/0001/upload \
  -F "images=@photo1.jpg" \
  -F "images=@photo2.jpg" \
  -F "images=@photo3.jpg" \
  -F "images=@photo4.jpg" \
  -F "images=@photo5.jpg" \
  -F "images=@photo6.jpg" \
  -F "text=원문 내용"

# AI 컨텐츠 생성
curl -X POST http://localhost:3000/api/sets/0001/generate

# HTML 빌드
curl -X POST http://localhost:3000/api/sets/0001/build

# PNG 캡처
curl -X POST http://localhost:3000/api/sets/0001/capture

# ZIP 다운로드
curl -O http://localhost:3000/api/sets/0001/download
```

## 🎨 카드 구조

| 페이지 | 템플릿 | 내용 |
|--------|--------|------|
| 1 | `template_page1.html` | 표지 (제목 + 배경 이미지) |
| 2-5 | `template_page2to5.html` | 본문 (소제목 + 단락 + 하이라이트) |
| 6 | `template_page6.html` | 마무리 (브랜드 메시지) |

## ⚙️ 환경변수

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `KIMI_API_KEY` | ✅ | - | Kimi (Moonshot) API 키 |
| `PORT` | ❌ | 3000 | 서버 포트 |
| `BASE_DIR` | ❌ | 프로젝트 루트 | 기본 디렉토리 경로 |

## 🛠️ 기술 스택

- **Backend**: Node.js, Express.js
- **AI**: Kimi (Moonshot) API
- **File Upload**: multer
- **Validation**: Zod
- **Screenshot**: Playwright
- **Archive**: archiver
- **Frontend**: Vanilla HTML/CSS/JS (SPA)

## 📝 브랜드 보이스 설정

`prompts/content-generation.md` 파일에서 AI 생성 컨텐츠의 톤앤매너를 조정할 수 있습니다:

```markdown
## 브랜드 보이스
- 어미: ~했어요, ~이에요, ~예요, ~거예요 (해요체)
- 어조: 차분하고 담담하게. 느낌표 금지. 마침표로 끝내기.
- 금지 표현: "놀랍게도", "충격적인", "믿기 힘든", "역대급"
```

## 🔧 CLI 도구

HTML 파일만 PNG로 변환하고 싶을 때:

```bash
node scripts/capture.mjs 0001
```

## 🐛 트러블슈팅

| 문제 | 해결책 |
|------|--------|
| 배경이 검정으로 나와요 | HTML의 `background-image`가 `file://` 절대경로인지 확인 |
| 폰트가 기본 폰트로 나와요 | `scripts/capture.mjs`의 `waitForTimeout`을 2000~3000ms로 증가 |
| `Cannot find module 'playwright'` | `npm install` 다시 실행 후 `npx playwright install chromium` |
| Kimi API 오류 | `.env` 파일의 `KIMI_API_KEY` 확인 |

## 📄 라이선스

MIT License © 2024 card-news-creator
