# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

인터뷰/스토리 원문 + 사진 6장 → 인스타그램 카드뉴스 PNG 6장 자동 생성 파이프라인.

## 파이프라인

```
STEP 1: create-card-content   input/{ID}/text.md 분석 → 텍스트 생성 → 유저 페이지별 승인
STEP 2: build-card-html       승인 컨텐츠 → output/{ID}/card-01~06.html (자동)
STEP 3: node scripts/capture.mjs {ID}   HTML → PNG 2160×2700px (자동)
```

**전체 실행 (권장):** `"0001번 카드뉴스 만들어줘"` → card-news-pipeline 스킬이 체이닝
**PNG만 캡처:** `node scripts/capture.mjs 0001`

## 카드 구조

| 페이지 | 템플릿 | 교체 항목 |
|--------|--------|----------|
| 1 (표지) | `template_page1.html` | 배경 이미지 + `<h1>` 제목 |
| 2~5 (본문) | `template_page2to5.html` × 4 | 배경 이미지 + 소제목 + 단락 + 하이라이트 |
| 6 (마무리) | `template_page6.html` | 배경 이미지만 (텍스트 고정) |

이미지 경로는 반드시 `file:///` 절대경로 — 상대경로 사용 시 배경이 검정으로 렌더링됨.

## 세트 추가

1. `input/{ID}/` 폴더 생성
2. 사진 6장 넣기 (알파벳 순 → 카드 1~6번에 자동 매핑)
3. `input/{ID}/text.md` 작성
4. `"{ID}번 카드뉴스 만들어줘"` 실행

## 주요 파일

| 목적 | 경로 |
|------|------|
| 캡처 스크립트 | `scripts/capture.mjs` |
| 표지 템플릿 | `template_page1.html` |
| 본문 템플릿 | `template_page2to5.html` |
| 마무리 템플릿 | `template_page6.html` |
| 컨텐츠 생성 스킬 | `.claude/skills/create-card-content/SKILL.md` |
| HTML 빌드 스킬 | `.claude/skills/build-card-html/SKILL.md` |
| PNG 캡처 스킬 | `.claude/skills/capture-card-png/SKILL.md` |
| 인스타 캡션 에이전트 | `.claude/agents/instagram-caption.md` |

## Playwright 설치

```bash
npm install playwright && npx playwright install chromium
```

`scripts/capture.mjs`가 없으면:
```bash
cp .claude/skills/capture-card-png/capture.mjs scripts/capture.mjs
```

## 트러블슈팅

| 증상 | 해결 |
|------|------|
| 배경이 검정 | HTML `background-image`가 `file://` 절대경로인지 확인 → build-card-html 재실행 |
| 폰트가 기본 폰트 | `scripts/capture.mjs`의 `waitForTimeout`을 2000~3000ms로 증가 |
| `Cannot find module 'playwright'` | Playwright 설치 명령 실행 |
