# 카드뉴스 웹 UI 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 누구나 브라우저에서 이미지+텍스트 업로드 → AI 컨텐츠 생성·승인 → PNG 다운로드까지 완료할 수 있는 로컬 웹 앱 구축

**Architecture:** Express.js 백엔드 + 바닐라 JS 프론트엔드(빌드 불필요). 세션 상태를 `input/{ID}/session.json`에 저장하며 Claude API로 컨텐츠를 생성한다. capture.mjs는 child process로 실행된다.

**Tech Stack:** Node.js, Express, @anthropic-ai/sdk, multer, archiver, dotenv, Vanilla HTML/CSS/JS

---

## 최종 폴더 구조

```
cardnewscontent/
├── server.js                  ← Express 서버 (npm start)
├── .env                       ← ANTHROPIC_API_KEY=sk-...
├── .env.example               ← 템플릿
├── lib/
│   ├── set-manager.js         ← ID 발급·디렉토리 관리
│   ├── claude-client.js       ← Claude API 호출·응답 파싱
│   └── html-builder.js        ← build-card-html 스킬 이식
├── public/
│   ├── index.html             ← SPA 뼈대
│   ├── style.css              ← UI 스타일
│   └── app.js                 ← 프론트엔드 상태머신
└── (기존) scripts/, input/, output/, template_*.html ...
```

---

## UI 흐름 (상태머신)

```
UPLOAD → GENERATING_TITLES → SELECT_TITLE
       → GENERATING_PAGE(2) → APPROVE_PAGE(2)
       → GENERATING_PAGE(3) → APPROVE_PAGE(3)
       → GENERATING_PAGE(4) → APPROVE_PAGE(4)
       → GENERATING_PAGE(5) → APPROVE_PAGE(5)
       → BUILDING_HTML → CAPTURING_PNG → DONE
```

---

## REST API

| Method | Path | 역할 |
|--------|------|------|
| GET | `/` | index.html 제공 |
| POST | `/api/sets` | 새 세트 ID 발급 |
| POST | `/api/sets/:id/upload` | 사진 6장 + 텍스트 업로드 |
| POST | `/api/sets/:id/titles` | Claude → 제목 후보 5개 |
| POST | `/api/sets/:id/title` | 선택한 제목 저장 |
| POST | `/api/sets/:id/pages/:n` | Claude → n페이지 컨텐츠 생성 |
| POST | `/api/sets/:id/pages/:n/approve` | 승인된 페이지 저장 |
| POST | `/api/sets/:id/build` | HTML 6개 빌드 |
| POST | `/api/sets/:id/capture` | PNG 6개 캡처 |
| GET | `/api/sets/:id/download` | ZIP 스트림 다운로드 |

---

## Task 1: 프로젝트 셋업

**Files:**
- Create: `.env.example`
- Create: `server.js` (기본 Express 뼈대)
- Modify: `package.json` (scripts + 의존성 추가)

**Step 1: 의존성 설치**

```bash
npm install express multer @anthropic-ai/sdk archiver dotenv
```

**Step 2: .env.example 작성**

```bash
# .env.example
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
BASE_DIR=/절대경로/cardnewscontent
```

**Step 3: server.js 기본 뼈대 작성**

```js
require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 라우터 등록 (이후 Task에서 추가)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ http://localhost:${PORT}`));
```

**Step 4: package.json scripts 추가**

```json
"scripts": {
  "start": "node server.js",
  "dev": "node --watch server.js"
}
```

**Step 5: 동작 확인**

```bash
cp .env.example .env
# .env에 실제 ANTHROPIC_API_KEY 입력
npm start
# → ✅ http://localhost:3000
```

**Step 6: 커밋**

```bash
git add server.js .env.example package.json package-lock.json
git commit -m "feat(web-ui): init Express server with dependencies"
```

---

## Task 2: Set Manager (ID 발급 + 파일 관리)

**Files:**
- Create: `lib/set-manager.js`

**Step 1: set-manager.js 작성**

```js
// lib/set-manager.js
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_DIR || __dirname + '/..';

function nextSetId() {
  const inputDir = path.join(BASE, 'input');
  if (!fs.existsSync(inputDir)) return '0001';
  const existing = fs.readdirSync(inputDir)
    .filter(d => /^\d{4}$/.test(d))
    .map(Number)
    .sort((a, b) => b - a);
  const next = existing.length ? existing[0] + 1 : 1;
  return String(next).padStart(4, '0');
}

function createSetDir(id) {
  const dir = path.join(BASE, 'input', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(BASE, 'output', id), { recursive: true });
  return dir;
}

function readSession(id) {
  const f = path.join(BASE, 'input', id, 'session.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
}

function writeSession(id, data) {
  const f = path.join(BASE, 'input', id, 'session.json');
  fs.writeFileSync(f, JSON.stringify(data, null, 2));
}

function getImagePaths(id) {
  const dir = path.join(BASE, 'input', id);
  return fs.readdirSync(dir)
    .filter(f => /\.(jpeg|jpg|png)$/i.test(f))
    .sort()
    .map(f => path.join(dir, f));
}

module.exports = { nextSetId, createSetDir, readSession, writeSession, getImagePaths, BASE };
```

**Step 2: POST /api/sets 라우트 추가 (server.js)**

```js
const { nextSetId, createSetDir } = require('./lib/set-manager');

app.post('/api/sets', (req, res) => {
  const id = nextSetId();
  createSetDir(id);
  res.json({ id });
});
```

**Step 3: 동작 확인**

```bash
curl -X POST http://localhost:3000/api/sets
# → {"id":"0002"}
```

**Step 4: 커밋**

```bash
git add lib/set-manager.js server.js
git commit -m "feat(web-ui): add set manager and POST /api/sets"
```

---

## Task 3: 파일 업로드 API

**Files:**
- Modify: `server.js`

**Step 1: multer 설정 + 업로드 라우트**

```js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { readSession, writeSession, BASE } = require('./lib/set-manager');

// multer: input/{id}/ 에 원본 파일명 저장
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(BASE, 'input', req.params.id));
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

app.post('/api/sets/:id/upload',
  upload.fields([
    { name: 'photos', maxCount: 6 },
    { name: 'text', maxCount: 1 }
  ]),
  (req, res) => {
    const { id } = req.params;
    // text 파일 → text.md 로 저장
    if (req.files.text) {
      const src = req.files.text[0].path;
      const dest = path.join(BASE, 'input', id, 'text.md');
      fs.renameSync(src, dest);
    }
    const session = readSession(id);
    session.status = 'uploaded';
    writeSession(id, session);
    res.json({ ok: true });
  }
);
```

**Step 2: 동작 확인**

```bash
curl -X POST http://localhost:3000/api/sets/0001/upload \
  -F "photos=@input/0001/IMG_5709.jpeg" \
  -F "text=@input/0001/text.md"
# → {"ok":true}
```

**Step 3: 커밋**

```bash
git add server.js
git commit -m "feat(web-ui): add file upload endpoint with multer"
```

---

## Task 4: Claude API 클라이언트

**Files:**
- Create: `lib/claude-client.js`

**Step 1: claude-client.js 작성**

```js
// lib/claude-client.js
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 브랜드 보이스 공통 지침
const BRAND_VOICE = `
어미: ~했어요, ~이에요, ~예요, ~거예요 (해요체)
어조: 차분하고 담담하게. 느낌표 금지. 마침표로 끝내기.
금지 표현: "놀랍게도", "충격적인", "믿기 힘든", "역대급"
한 문장 15자 초과 시 \\n으로 줄바꿈 표시.
`;

async function generateTitles(text) {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `다음 원문을 읽고 인스타그램 카드뉴스 1페이지 표지 제목 후보 5개를 만들어줘.

브랜드 톤:
${BRAND_VOICE}

제목 규칙:
- 반드시 2~3줄 구조 (한 줄로 쓰지 않는다)
- 줄마다 7~12자 이내
- [상황/배경] → [행동/선택] → [이유/결과] 순서로 긴장감을 쌓는다
- 마지막 줄이 독자의 궁금증을 자극하는 훅(hook)이어야 한다
- 느낌표 금지

출력 형식 (JSON만, 설명 없이):
{"titles": [
  {"line1":"...","line2":"...","line3":"..."},
  ...5개...
]}

원문:
${text}`
    }]
  });
  return JSON.parse(msg.content[0].text);
}

async function generatePage(n, text, title, previousPages) {
  const prevContext = previousPages.map((p, i) =>
    `${i + 2}페이지 소제목: ${p.subtitle}`
  ).join('\n');

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `인스타그램 카드뉴스 ${n}페이지 본문을 생성해줘.

브랜드 톤:
${BRAND_VOICE}

컨텐츠 길이 제한:
- 소제목: 15자 이내
- 본문 단락: 최대 3개, 단락당 최대 2문장
- 하이라이트: 본문 문장 중 1개 그대로 선택 (새로 작성 금지), 40자 이내

확정된 표지 제목: ${title}
${prevContext ? `이미 승인된 페이지:\n${prevContext}` : ''}

출력 형식 (JSON만, 설명 없이):
{
  "subtitle": "...",
  "paragraphs": [
    {"sentences": ["문장1", "문장2"]},
    {"sentences": ["문장3"], "highlight": "하이라이트 문장"},
    {"sentences": ["문장4"]}
  ]
}

원문:
${text}`
    }]
  });
  return JSON.parse(msg.content[0].text);
}

module.exports = { generateTitles, generatePage };
```

**Step 2: 타이틀 생성 라우트 추가 (server.js)**

```js
const { generateTitles, generatePage } = require('./lib/claude-client');
const { readSession, writeSession, BASE, getImagePaths } = require('./lib/set-manager');
const path = require('path');
const fs = require('fs');

app.post('/api/sets/:id/titles', async (req, res) => {
  const { id } = req.params;
  const text = fs.readFileSync(path.join(BASE, 'input', id, 'text.md'), 'utf8');
  const result = await generateTitles(text);
  res.json(result);
});

app.post('/api/sets/:id/title', (req, res) => {
  const { id } = req.params;
  const session = readSession(id);
  session.title = req.body.title;  // "line1\nline2\nline3"
  session.status = 'title_selected';
  writeSession(id, session);
  res.json({ ok: true });
});

app.post('/api/sets/:id/pages/:n', async (req, res) => {
  const { id, n } = req.params;
  const session = readSession(id);
  const text = fs.readFileSync(path.join(BASE, 'input', id, 'text.md'), 'utf8');
  const previousPages = (session.pages || []).slice(0, Number(n) - 2);
  const result = await generatePage(Number(n), text, session.title, previousPages);
  res.json(result);
});

app.post('/api/sets/:id/pages/:n/approve', (req, res) => {
  const { id, n } = req.params;
  const session = readSession(id);
  if (!session.pages) session.pages = [];
  session.pages[Number(n) - 2] = req.body;  // pages[0]=page2, pages[1]=page3...
  session.status = `page_${n}_approved`;
  writeSession(id, session);
  res.json({ ok: true });
});
```

**Step 3: 커밋**

```bash
git add lib/claude-client.js server.js
git commit -m "feat(web-ui): add Claude API client and content generation routes"
```

---

## Task 5: HTML 빌더

**Files:**
- Create: `lib/html-builder.js`

**Step 1: html-builder.js 작성 (build-card-html 스킬 이식)**

```js
// lib/html-builder.js
const fs = require('fs');
const path = require('path');

function buildHtml(id, session) {
  const BASE = process.env.BASE_DIR || path.join(__dirname, '..');
  const inputDir = path.join(BASE, 'input', id);
  const outputDir = path.join(BASE, 'output', id);
  fs.mkdirSync(outputDir, { recursive: true });

  // 이미지 → file:// 절대경로 변환
  const images = fs.readdirSync(inputDir)
    .filter(f => /\.(jpeg|jpg|png)$/i.test(f))
    .sort()
    .map(f => `file://${path.join(inputDir, f)}`);

  // 템플릿 읽기
  const t1 = fs.readFileSync(path.join(BASE, 'template_page1.html'), 'utf8');
  const t2 = fs.readFileSync(path.join(BASE, 'template_page2to5.html'), 'utf8');
  const t6 = fs.readFileSync(path.join(BASE, 'template_page6.html'), 'utf8');

  // card-01: 표지
  const h1Text = session.title.split('\n').join('<br>');
  const card1 = t1
    .replace(/background-image: url\('[^']+'\)/, `background-image: url('${images[0]}')`)
    .replace(/<h1>[^<]*<\/h1>/, `<h1>${h1Text}</h1>`);
  fs.writeFileSync(path.join(outputDir, 'card-01.html'), card1);

  // card-02~05: 본문
  session.pages.forEach((page, i) => {
    const pageNum = i + 2;
    const paragraphsHtml = page.paragraphs.map(para => {
      const sentences = para.sentences.map(s =>
        `<p>${s.replace(/\n/g, '<br>')}</p>`
      ).join('\n                ');
      const highlight = para.highlight
        ? `\n                <div><span class="highlight">"${para.highlight}"</span></div>`
        : '';
      return `\n            <div class="paragraph">\n                ${sentences}${highlight}\n            </div>`;
    }).join('\n');

    const card = t2
      .replace(/background-image: url\('[^']+'\)/, `background-image: url('${images[pageNum - 1]}')`)
      .replace(/<h2 class="title">[^<]*<\/h2>/, `<h2 class="title">${page.subtitle}</h2>`)
      .replace(/(<div class="content">)[\s\S]*?(<\/div>\s*<\/div>\s*<\/body>)/,
        `$1\n            <h2 class="title">${page.subtitle}</h2>${paragraphsHtml}\n        $2`);

    fs.writeFileSync(path.join(outputDir, `card-0${pageNum}.html`), card);
  });

  // card-06: 브랜드 마무리
  const card6 = t6
    .replace(/background-image: url\('[^']+'\)/, `background-image: url('${images[5]}')`);
  fs.writeFileSync(path.join(outputDir, 'card-06.html'), card6);

  return Array.from({ length: 6 }, (_, i) =>
    path.join(outputDir, `card-0${i + 1}.html`)
  );
}

module.exports = { buildHtml };
```

**Step 2: /api/sets/:id/build 라우트 추가**

```js
const { buildHtml } = require('./lib/html-builder');

app.post('/api/sets/:id/build', (req, res) => {
  const { id } = req.params;
  const session = readSession(id);
  const files = buildHtml(id, session);
  session.status = 'html_built';
  writeSession(id, session);
  res.json({ htmlFiles: files });
});
```

**Step 3: 커밋**

```bash
git add lib/html-builder.js server.js
git commit -m "feat(web-ui): add HTML builder (port of build-card-html skill)"
```

---

## Task 6: PNG 캡처 + 다운로드

**Files:**
- Modify: `server.js`

**Step 1: capture + download 라우트 추가**

```js
const { execFile } = require('child_process');
const archiver = require('archiver');

app.post('/api/sets/:id/capture', (req, res) => {
  const { id } = req.params;
  const script = path.join(__dirname, 'scripts', 'capture.mjs');
  execFile('node', [script, id], { cwd: __dirname }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: stderr });
    const session = readSession(id);
    session.status = 'done';
    writeSession(id, session);
    res.json({ ok: true, output: stdout });
  });
});

app.get('/api/sets/:id/download', (req, res) => {
  const { id } = req.params;
  const outputDir = path.join(BASE, 'output', id);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="cardnews-${id}.zip"`);
  const archive = archiver('zip');
  archive.pipe(res);
  archive.directory(outputDir, false);
  archive.finalize();
});
```

**Step 2: 동작 확인 (0001 기존 세트 재캡처)**

```bash
curl -X POST http://localhost:3000/api/sets/0001/capture
# → {"ok":true}
curl http://localhost:3000/api/sets/0001/download -o test.zip
# → test.zip에 card-01.png~card-06.png
```

**Step 3: 커밋**

```bash
git add server.js
git commit -m "feat(web-ui): add capture and ZIP download endpoints"
```

---

## Task 7: 프론트엔드 (SPA)

**Files:**
- Create: `public/index.html`
- Create: `public/style.css`
- Create: `public/app.js`

### 7-1. index.html 구조

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>카드뉴스 생성기</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">
    <!-- Screen: upload -->
    <section id="screen-upload" class="screen active">
      <h1>📰 카드뉴스 생성기</h1>
      <div id="photo-grid">
        <!-- 6개 드롭존 (JS로 생성) -->
      </div>
      <textarea id="text-input" placeholder="원문 텍스트를 붙여넣으세요..."></textarea>
      <button id="btn-generate">컨텐츠 생성 시작</button>
    </section>

    <!-- Screen: title select -->
    <section id="screen-titles" class="screen">
      <h2>1페이지 제목 선택</h2>
      <div id="titles-list"></div>
    </section>

    <!-- Screen: page approve -->
    <section id="screen-page" class="screen">
      <h2 id="page-label">2페이지 검토</h2>
      <div id="page-content"></div>
      <div class="actions">
        <button id="btn-regenerate">다시 생성</button>
        <button id="btn-approve">다음 →</button>
      </div>
    </section>

    <!-- Screen: progress -->
    <section id="screen-progress" class="screen">
      <h2>⏳ 생성 중...</h2>
      <div id="progress-log"></div>
    </section>

    <!-- Screen: done -->
    <section id="screen-done" class="screen">
      <h2>🎉 완성!</h2>
      <div id="preview-grid"></div>
      <button id="btn-download">PNG 다운로드 (ZIP)</button>
      <button id="btn-new">새 카드뉴스</button>
    </section>
  </div>
  <script src="app.js"></script>
</body>
</html>
```

### 7-2. style.css 핵심 스타일

```css
/* 다크 테마, 카드 그리드, 드롭존, 버튼 스타일 */
/* 전체 너비 900px 센터, 각 단계 fade 전환 */
/* 사진 그리드: 3열×2행, 각 셀에 번호 표시 */
/* 하이라이트 미리보기: 흰 배경 + 검정 텍스트 */
```

### 7-3. app.js 상태머신 핵심 로직

```js
let state = { setId: null, currentPage: 2 };

async function createSet() {
  const { id } = await post('/api/sets');
  state.setId = id;
}

async function uploadFiles(photos, text) {
  const fd = new FormData();
  photos.forEach(f => fd.append('photos', f));
  fd.append('text', new Blob([text], {type:'text/plain'}), 'text.md');
  await fetch(`/api/sets/${state.setId}/upload`, { method: 'POST', body: fd });
}

async function loadTitles() {
  showScreen('screen-titles');
  const { titles } = await post(`/api/sets/${state.setId}/titles`);
  renderTitles(titles);
}

async function selectTitle(title) {
  await post(`/api/sets/${state.setId}/title`, { title });
  state.currentPage = 2;
  await loadPage(2);
}

async function loadPage(n) {
  showScreen('screen-page');
  document.getElementById('page-label').textContent = `${n}페이지 검토 (${n-1}/4)`;
  const page = await post(`/api/sets/${state.setId}/pages/${n}`);
  renderPage(page);
  state.pendingPage = page;
}

async function approvePage() {
  await post(`/api/sets/${state.setId}/pages/${state.currentPage}/approve`, state.pendingPage);
  if (state.currentPage < 5) {
    state.currentPage++;
    await loadPage(state.currentPage);
  } else {
    await buildAndCapture();
  }
}

async function buildAndCapture() {
  showScreen('screen-progress');
  log('HTML 빌드 중...');
  await post(`/api/sets/${state.setId}/build`);
  log('✅ HTML 완료');
  log('PNG 캡처 중...');
  await post(`/api/sets/${state.setId}/capture`);
  log('✅ 캡처 완료');
  showResults();
}

function showResults() {
  showScreen('screen-done');
  document.getElementById('btn-download').onclick = () => {
    window.location.href = `/api/sets/${state.setId}/download`;
  };
}
```

**Step 1: public/ 파일 3개 작성 (위 구조 기반 전체 구현)**

**Step 2: 브라우저에서 전체 흐름 검증**

```
1. http://localhost:3000 접속
2. 사진 6장 드래그앤드롭 → 번호 미리보기 확인
3. 텍스트 붙여넣기 → 컨텐츠 생성 시작
4. 제목 5개 → 하나 선택
5. 2~5페이지 순서대로 검토·승인
6. HTML 빌드 → PNG 캡처 자동 진행
7. ZIP 다운로드 → 파일 6개 확인
```

**Step 3: 커밋**

```bash
git add public/
git commit -m "feat(web-ui): add complete frontend SPA (upload → approve → download)"
```

---

## Task 8: 에러 처리 + 사용성 마무리

**Files:**
- Modify: `server.js`, `public/app.js`

**Step 1: 서버 전역 에러 핸들러**

```js
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});
```

**Step 2: 프론트엔드 로딩 인디케이터**

- AI 생성 중 버튼 비활성화 + 스피너 표시
- 에러 발생 시 토스트 메시지

**Step 3: 드래그앤드롭 사진 순서 변경 (선택)**

- 각 사진 셀을 drag handle로 재정렬 가능
- 업로드 순서가 카드 순서에 반영

**Step 4: .env 없을 때 안내 메시지**

```js
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ .env 파일에 ANTHROPIC_API_KEY를 설정하세요.');
  process.exit(1);
}
```

**Step 5: 커밋**

```bash
git add server.js public/app.js
git commit -m "feat(web-ui): add error handling and UX polish"
```

---

## Phase 2 (선택): 에이전트 통합

`.claude/agents/`에 정의된 에이전트를 Claude API 호출로 통합:

| 에이전트 | 통합 위치 | 역할 |
|---------|---------|------|
| `image-curator` | 업로드 직후 | 사진 순서 AI 추천 (표지에 어울리는 사진) |
| `content-reviewer` | 5페이지 승인 직후 | 전체 컨텐츠 일관성 검토 + 수정 제안 |
| `instagram-caption` | PNG 캡처 완료 후 | 인스타그램 캡션 자동 생성 |

---

## 검증 체크리스트

- [ ] `npm start` → localhost:3000 정상 접속
- [ ] 사진 6장 드래그앤드롭 → 번호 미리보기
- [ ] 텍스트 붙여넣기 → AI 제목 5개 생성
- [ ] 제목 선택 → 2페이지 AI 생성
- [ ] 각 페이지 승인 → 순서대로 다음 페이지
- [ ] 5페이지 승인 → HTML 자동 빌드
- [ ] HTML 완료 → PNG 자동 캡처
- [ ] ZIP 다운로드 → 6개 PNG 정상 포함
- [ ] ANTHROPIC_API_KEY 없으면 서버 시작 시 명확한 에러
