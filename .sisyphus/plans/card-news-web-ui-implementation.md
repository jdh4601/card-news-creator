# 카드뉴스 웹 UI 구현 전략

> **Plan**: `docs/plans/2026-03-02-card-news-web-ui.md` 기반
> **Metis Review**: Critical gaps identified and addressed

## 🎯 목표

Express.js 백엔드 + 바닐라 JS 프론트엔드로 카드뉴스 생성 웹 앱 구축
**핵심 흐름**: 파일 업로드 (6장 사진 + 텍스트) → AI 컨텐츠 생성 → 승인 플로우 → PNG 다운로드

---

## 🔍 Metis Gap Analysis 결과

### Critical Issues (반드시 해결)

| Issue | Impact | Solution |
|-------|--------|----------|
| `file:///` Path Duality | 브라우저 미리보기 실패 | HTML Builder에 `pathMode` 파라미터 추가 (`'file'` vs `'http'`) |
| `capture.mjs` CLI-only | 서버에서 import 불가 | Task 6에서 exportable 함수로 리팩토링 + CLI wrapper 유지 |
| Module System Conflict | CommonJS vs ESM 충돌 | Task 1에서 `"type": "module"`로 변경, ESM 통일 |
| Brand Voice Encoding | Claude API 응답 형식 불일치 | SKILL.md에서 규칙 추출하여 prompt template 생성 |

### Architecture Decisions (사전 결정 필요)

1. **Deployment Target**: Local-only (localhost 3000)
2. **User Model**: Single-user 도구 (동시성 처리 단순화)
3. **Content Generation**: 한 번에 모든 페이지 생성 (title + 4 pages), 승인은 프론트엔드에서
4. **Path Strategy**: 
   - Capture HTML: `file:///Users/.../input/0001/IMG_5709.jpeg`
   - Preview HTML: `/api/sets/0001/images/IMG_5709.jpeg`

---

## 📊 Dependency Graph

```
Wave 1 (No Dependencies - Parallel):
├── Task 1: Project Setup
│   └── install: express, multer, archiver, @anthropic-ai/sdk, zod, dotenv
│   └── change package.json "type" to "module"
├── Task 2: Set Manager (ID + file management)
└── Task 4-PREP: Extract brand voice from SKILL.md

Wave 2 (Depends on Wave 1):
├── Task 3: File Upload API (needs Set Manager)
└── Task 4: Claude API Client (needs brand voice rules)

Wave 3 (Depends on Wave 2):
├── Task 5: HTML Builder (needs upload API for images)
└── Task 6-PREP: Refactor capture.mjs

Wave 4 (Depends on Wave 3):
├── Task 6: PNG Capture + Download (needs HTML builder, capture refactor)

Wave 5 (Depends on Wave 4):
├── Task 7: Frontend SPA (needs all backend APIs)

Wave 6 (Depends on Wave 5):
└── Task 8: Error Handling + UX Polish
```

### Parallelization Summary

| Wave | Tasks | Can Parallelize |
|------|-------|-----------------|
| 1 | T1, T2, T4-PREP | ✅ Yes - independent |
| 2 | T3, T4 | ✅ Yes - both need Wave 1 |
| 3 | T5, T6-PREP | ✅ Yes - independent |
| 4 | T6 | ❌ No - needs T5 + T6-PREP |
| 5 | T7 | ❌ No - needs all backend |
| 6 | T8 | ❌ No - final polish |

**Speedup**: T1-T2-T4PREP 병렬 실행 시 ~40% 시간 단축

---

## 🛡️ Guardrails (Scope Boundaries)

### Must NOT Include
- Database (SQLite, MongoDB, etc.) - use session.json files only
- User authentication / accounts
- WebSocket / real-time updates
- Image resizing or format conversion
- Rich text editor
- PDF export
- Multiple resolution options
- Analytics / logging dashboard

### Must Include
- File upload validation (MIME type, count = 6, max 10MB)
- Path traversal prevention (`../` blocked)
- Claude API key server-side only (never frontend)
- Zod validation for API responses
- Error toasts + loading states

---

## 📝 Task Specifications

### Task 1: Project Setup
**Files**: `package.json`, `.env.example`, `server.js` (skeleton)

**Changes**:
```json
// package.json
{
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.x",
    "multer": "^1.x",
    "archiver": "^6.x",
    "@anthropic-ai/sdk": "^0.x",
    "zod": "^3.x",
    "dotenv": "^16.x",
    "playwright": "^1.58.2"
  }
}
```

**Acceptance**:
```bash
npm install
npm start
# → ✅ Server running on http://localhost:3000
curl http://localhost:3000/health
# → {"ok":true}
```

---

### Task 2: Set Manager
**File**: `lib/set-manager.js`

**Functions**:
- `nextSetId()`: Scan `input/`, return next 4-digit ID (0001, 0002...)
- `createSetDir(id)`: Create `input/{id}/`, `output/{id}/`
- `readSession(id)`, `writeSession(id, data)`: JSON persistence
- `getImagePaths(id)`: Return sorted image file paths

**Constraints**:
- ID format: `/^\d{4}$/`
- Reject path traversal attempts

---

### Task 3: File Upload API
**File**: `server.js` (add routes)

**Endpoint**: `POST /api/sets/:id/upload`

**Multer Config**:
- Destination: `input/{id}/`
- Rename: `photo-1.jpg` ... `photo-6.jpg` (alphabetical order for page mapping)
- Text: Save as `text.md`

**Validation**:
- Exactly 6 images
- MIME type: `image/jpeg` or `image/png`
- Max 10MB per file

**Acceptance**:
```bash
curl -X POST http://localhost:3000/api/sets/0001/upload \
  -F "images=@test1.jpg" -F "images=@test2.jpg" \
  -F "images=@test3.jpg" -F "images=@test4.jpg" \
  -F "images=@test5.jpg" -F "images=@test6.jpg" \
  -F "text=테스트 원문"
# → {"status":"uploaded"}
```

---

### Task 4: Claude API Client
**Files**: `lib/claude-client.js`, `prompts/content-generation.md`

**Prompt Template** (`prompts/content-generation.md`):
```markdown
# System Prompt: 카드뉴스 컨텐츠 생성

## 브랜드 보이스
- 어미: ~했어요, ~이에요, ~예요, ~거예요 (해요체)
- 어조: 차분하고 담담하게. 느낌표 금지. 마침표로 끝내기.
- 금지: "놀랍게도", "충격적인", "믿기 힘든", "역대급"

## 출력 형식 (JSON)
{
  "title": {"line1": "...", "line2": "...", "line3": "..."},
  "pages": [
    {"subtitle": "...", "paragraphs": [...], "highlight": "..."},
    // 4 pages total
  ]
}

## 규칙
- 제목: 2-3줄, 줄마다 7-12자
- 소제목: 15자 이내
- 본문: 최대 3단락, 단락당 최대 2문장
- 하이라이트: 본문 문장 중 1개 그대로 선택, 40자 이내
```

**Functions**:
- `generateContent(text: string): Promise<ContentResult>`
- Response validation with Zod schema
- Retry logic: max 2 retries on parse failure

**Acceptance**:
```bash
curl -X POST http://localhost:3000/api/sets/0001/generate
# → {"title":{...},"pages":[...]} (5 items total)
```

---

### Task 5: HTML Builder
**File**: `lib/html-builder.js`

**Function**: `buildHtml(id, session, pathMode)`

**Path Modes**:
- `pathMode: 'file'`: `file:///Users/.../input/{id}/photo-1.jpg` (for Playwright)
- `pathMode: 'http'`: `/api/sets/{id}/images/photo-1.jpg` (for browser preview)

**Templates**:
- Page 1: `template_page1.html` → `card-01.html` (cover)
- Pages 2-5: `template_page2to5.html` → `card-02.html` ... `card-05.html`
- Page 6: `template_page6.html` → `card-06.html` (brand ending)

**Replacements**:
- `background-image: url('...')`
- `<h1>...</h1>` (page 1)
- `<h2 class="title">...</h2>` + `.content` inner HTML (pages 2-5)

**Acceptance**:
```bash
ls output/0001/card-*.html | wc -l
# → 6
grep -c 'file:///' output/0001/card-01.html
# → ≥ 1
```

---

### Task 6: PNG Capture + Download
**Files**: `lib/capture.js` (refactored), `server.js` (routes)

**Refactor `scripts/capture.mjs`**:
```javascript
// lib/capture.js
export async function captureSet(setId, outputDir) {
  // Playwright logic from original capture.mjs
  // Return: array of PNG file paths
  // Throw on error (NEVER process.exit)
}

// CLI wrapper (for backward compatibility)
if (import.meta.url === `file://${process.argv[1]}`) {
  const setId = process.argv[2];
  captureSet(setId, `output/${setId}`).catch(console.error);
}
```

**Routes**:
- `POST /api/sets/:id/capture` → Run captureSet, return PNG paths
- `GET /api/sets/:id/download` → ZIP all PNGs, stream download

**Acceptance**:
```bash
curl -X POST http://localhost:3000/api/sets/0001/capture
# → {"pngFiles":["output/0001/card-01.png",...]}
curl http://localhost:3000/api/sets/0001/download -o test.zip
unzip -l test.zip | grep -c '.png'
# → 6
```

---

### Task 7: Frontend SPA
**Files**: `public/index.html`, `public/style.css`, `public/app.js`

**Screens**:
1. **Upload**: Photo grid (6 slots) + text textarea + "시작" button
2. **Title Select**: 5 generated titles, clickable selection
3. **Page Review**: Page 2-5, one at a time, "승인" / "재생성" buttons
4. **Progress**: "HTML 빌드 중..." → "PNG 캡처 중..."
5. **Done**: Preview grid + ZIP download button

**State Machine**:
```
UPLOAD → GENERATING → TITLE_SELECT
  → PAGE_2 → PAGE_3 → PAGE_4 → PAGE_5
  → BUILDING → CAPTURING → DONE
```

**Acceptance**:
- All screens navigable
- Upload shows image previews
- API errors show toast notifications
- Loading states disable buttons

---

### Task 8: Error Handling + UX Polish
**Files**: `server.js`, `public/app.js`

**Server**:
- Global error handler middleware
- Validate ANTHROPIC_API_KEY on startup
- Clear error messages (Korean)

**Frontend**:
- Toast notifications for errors
- Loading spinners during API calls
- Disable buttons during processing
- Handle browser refresh (reload session state)

---

## 🧪 Testing Strategy

### Backend Tests (curl-based)

```bash
# Health check
curl http://localhost:3000/health | jq

# Create set
curl -X POST http://localhost:3000/api/sets | jq

# Upload (with 6 test images)
curl -X POST http://localhost:3000/api/sets/0001/upload \
  -F "images=@test1.jpg" ... -F "text=test"

# Generate content
curl -X POST http://localhost:3000/api/sets/0001/generate | jq

# Build HTML
curl -X POST http://localhost:3000/api/sets/0001/build | jq

# Capture PNG
curl -X POST http://localhost:3000/api/sets/0001/capture | jq

# Download ZIP
curl -O http://localhost:3000/api/sets/0001/download
```

### Frontend Tests (Playwright)

```javascript
// E2E: Full flow
await page.goto('http://localhost:3000');
await page.setInputFiles('#photos', ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg']);
await page.fill('#text', '테스트 원문');
await page.click('#btn-start');
// ... verify each step
```

---

## 📂 Final Directory Structure

```
cardnewscontent/
├── server.js                    # Express server
├── .env                         # ANTHROPIC_API_KEY
├── .env.example                 # Template
├── package.json                 # ESM modules, scripts
├── lib/
│   ├── set-manager.js          # ID + file management
│   ├── claude-client.js        # Claude API integration
│   ├── html-builder.js         # HTML generation
│   └── capture.js              # Playwright capture (refactored)
├── prompts/
│   └── content-generation.md   # Brand voice + rules
├── public/                     # Frontend SPA
│   ├── index.html
│   ├── style.css
│   └── app.js
├── scripts/
│   └── capture.mjs             # CLI wrapper (calls lib/capture.js)
├── input/                      # Upload destination
│   └── 0001/
│       ├── photo-1.jpg
│       ├── ...
│       ├── photo-6.jpg
│       ├── text.md
│       └── session.json
├── output/                     # Generated files
│   └── 0001/
│       ├── card-01.html
│       ├── ...
│       ├── card-06.html
│       ├── card-01.png
│       └── ...
└── template_*.html             # Source templates
```

---

## 🚀 Execution Command

```bash
# Run the implementation plan
/start-work
```

This will:
1. Load this plan as the active boulder
2. Execute tasks in dependency order
3. Track progress across all sessions
4. Enable automatic continuation if interrupted

---

## ⚠️ Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Claude API response format drift | Zod validation + retry logic |
| capture.mjs refactor breaks CLI | Keep thin CLI wrapper |
| `file:///` paths break on Windows | Use `pathToFileURL` from `url` module |
| Korean characters in paths | Proper URI encoding |
| Memory exhaustion from Chromium | Single concurrent capture (queue) |
| Orphaned session files | Cleanup on server startup |

---

**Plan Status**: ✅ Ready for execution
**Next Step**: Run `/start-work` to begin implementation
