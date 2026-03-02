---
name: card-news-pipeline
description: 카드뉴스 전체 파이프라인을 처음부터 끝까지 실행할 때 사용. 세트 ID만 주면 컨텐츠 생성 → HTML 빌드 → PNG 캡처를 순서대로 진행한다.
---

# card-news-pipeline

세트 ID 하나로 4개 스텝을 순서대로 체이닝한다.

```
[1] create-card-content  →  컨텐츠 생성 + 페이지별 유저 승인
        ↓ (전체 확정 후)
[2] build-card-html      →  HTML 6개 생성 (자동)
        ↓ (HTML 완성 후)
[3] capture-card-png     →  PNG 6개 캡처 (자동)
        ↓ (PNG 완성 후)
[4] instagram-caption    →  인스타그램 캡션 생성 (자동)
```

**유저가 개입하는 지점은 STEP 1 뿐이다.**
STEP 2~4는 승인 후 자동 연속 실행.

---

## 실행 트리거

유저가 아래 중 하나를 말하면 이 파이프라인을 실행한다:

- `"카드뉴스 만들어줘"`
- `"0001번 카드뉴스 만들어줘"`
- `"파이프라인 실행"`
- `"처음부터 끝까지 만들어줘"`

ID가 없으면: `ls input/` 출력 후 선택 요청.

---

## STEP 1: create-card-content

**REQUIRED SKILL:** `create-card-content`

create-card-content SKILL.md의 전체 프로세스를 그대로 따른다.

```
STEP 0: input/{ID}/text.md 읽기 + input/{ID}/ 이미지 스캔
STEP 1: 1페이지 제목 5개 제안 → 유저 선택
STEP 2: 2페이지 생성 → 유저 "다음" 승인
STEP 3: 3페이지 생성 → 유저 "다음" 승인
STEP 4: 4페이지 생성 → 유저 "다음" 승인
STEP 5: 5페이지 생성 → 유저 "다음" 승인
STEP 6: 전체 컨텐츠 확정 출력
```

전체 확정 출력 후 유저 승인 없이 즉시 STEP 2로 진행한다.
(STEP 6 말미에 "HTML을 자동으로 생성합니다." 라고 알린다)

---

## STEP 2: build-card-html (자동)

**REQUIRED SKILL:** `build-card-html`

STEP 1 확정 컨텐츠를 그대로 받아 build-card-html을 실행한다.

```
mkdir -p output/{ID}
→ card-01.html (표지)
→ card-02.html ~ card-05.html (본문 4장)
→ card-06.html (브랜드 마무리)
```

6개 파일 생성 완료 후 유저 승인 없이 즉시 STEP 3으로 진행한다.
(완료 시 "PNG 캡처를 시작합니다." 라고 알린다)

---

## STEP 3: capture-card-png (자동)

**REQUIRED SKILL:** `capture-card-png`

capture.mjs 스크립트 존재 여부 확인 후 실행한다.

```bash
# scripts/capture.mjs 없으면 먼저 복사
cp .claude/skills/capture-card-png/capture.mjs scripts/capture.mjs

# 캡처 실행
node scripts/capture.mjs {ID}
```

---

## STEP 4: instagram-caption (자동)

**REQUIRED AGENT:** `instagram-caption`

PNG 캡처 완료 후 유저 승인 없이 즉시 실행한다.
(실행 전 "인스타그램 캡션을 생성합니다." 라고 알린다)

STEP 1에서 확정된 전체 컨텐츠(1~5페이지 소제목·본문)를 instagram-caption 에이전트에 전달한다.
에이전트가 캡션을 출력하면 파이프라인이 종료된다.

---

## 완료 출력 형식

모든 단계 완료 후:

```
🎉 카드뉴스 {ID} 세트 완성

📁 output/{ID}/
   card-01.png  (표지)
   card-02.png  (2페이지)
   card-03.png  (3페이지)
   card-04.png  (4페이지)
   card-05.png  (5페이지)
   card-06.png  (브랜드 마무리)

[instagram-caption 에이전트 출력 결과]

총 소요: [STEP 수] 페이지 승인 완료
```

---

## 오류 처리

| 오류 상황 | 대응 |
|-----------|------|
| `input/{ID}/` 없음 | "해당 ID의 폴더가 없습니다." 출력 후 중단 |
| `input/{ID}/text.md` 없음 | "텍스트 파일이 없습니다." 출력 후 중단 |
| 이미지 6개 미만 | 경고 출력 후 있는 이미지로 진행 (부족한 페이지는 기본 이미지 유지) |
| playwright 미설치 | `npm install playwright && npx playwright install chromium` 실행 안내 |
| STEP 2 실패 | HTML 오류 내용 출력 후 중단. STEP 3는 실행하지 않음 |

---

## 개별 스킬 단독 실행

특정 단계만 재실행이 필요할 때:

| 재실행 필요 상황 | 실행 |
|-----------------|------|
| 컨텐츠를 다시 쓰고 싶다 | `create-card-content` 단독 |
| HTML만 다시 만들고 싶다 | `build-card-html` 단독 |
| PNG만 다시 캡처하고 싶다 | `node scripts/capture.mjs {ID}` |
| 캡션만 다시 쓰고 싶다 | `instagram-caption` 에이전트 단독 |
