---
name: capture-card-png
description: build-card-html로 생성된 HTML 파일 6개를 PNG로 캡처할 때 사용. Playwright로 1080×1350px 카드를 2x Retina 해상도로 저장한다.
---

# capture-card-png

`output/{ID}/*.html` → `output/{ID}/*.png` 변환.
Playwright headless Chromium으로 각 HTML을 2160×2700px PNG로 캡처한다.

---

## 실행 전 체크리스트

```bash
# 1. HTML 파일 존재 확인
ls output/{ID}/*.html

# 2. capture.mjs 스크립트 존재 확인
ls scripts/capture.mjs
```

`scripts/capture.mjs`가 없으면 스킬 디렉토리에서 복사한다:
```bash
mkdir -p scripts
cp .claude/skills/capture-card-png/capture.mjs scripts/capture.mjs
```

---

## Playwright 설치 확인

```bash
# 설치 여부 확인
node -e "require('playwright')" 2>/dev/null && echo "OK" || echo "NOT_INSTALLED"
```

**NOT_INSTALLED이면:**
```bash
npm init -y          # package.json 없으면
npm install playwright
npx playwright install chromium
```

---

## 실행

```bash
node scripts/capture.mjs {ID}
# 예: node scripts/capture.mjs 0001
```

ID 생략 시 기본값 `0001` 사용.

---

## 출력 결과

```
output/{ID}/
├── card-01.html  →  card-01.png  (2160×2700px)
├── card-02.html  →  card-02.png
├── card-03.html  →  card-03.png
├── card-04.html  →  card-04.png
├── card-05.html  →  card-05.png
└── card-06.html  →  card-06.png
```

스크립트 완료 후 `PROMPT-PASS 출력 경로:` 아래 절대경로 목록이 출력된다.
이 경로들을 컨텍스트에 붙이지 말고 경로만 보고하면 된다.

---

## 스크립트 핵심 설정값

| 설정 | 값 | 비고 |
|------|-----|------|
| viewport | 1080×1350px | 카드 사이즈 |
| deviceScaleFactor | 2 | Retina 2x (실제 2160×2700px) |
| waitUntil | networkidle | 폰트/이미지 로딩 완료 후 캡처 |
| waitForTimeout | 1500ms | 추가 안전 대기 |
| 캡처 대상 | `.card-container` | 카드 영역만 캡처 |

해상도 변경이 필요하면 `scripts/capture.mjs`의 `deviceScaleFactor` 값을 수정한다.

---

## 흔한 실수와 해결책

| 증상 | 원인 | 해결책 |
|------|------|--------|
| 배경 이미지가 검정으로 나옴 | HTML의 이미지 경로가 `file://` 절대경로가 아님 | build-card-html에서 경로 재확인 |
| `Cannot find module 'playwright'` | playwright 미설치 | `npm install playwright && npx playwright install chromium` |
| `card-container not found` | HTML 구조가 템플릿과 다름 | build-card-html 출력 파일 확인 |
| PNG가 일부만 생성됨 | 해당 HTML 파일 없음 | `ls output/{ID}/*.html` 확인 |
| 폰트가 기본 폰트로 나옴 | Pretendard CDN 로딩 실패 | `waitForTimeout`을 2000~3000ms로 늘리기 |
