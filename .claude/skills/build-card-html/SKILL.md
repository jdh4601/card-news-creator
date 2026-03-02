---
name: build-card-html
description: create-card-content로 승인된 카드뉴스 컨텐츠를 HTML로 변환할 때 사용. 템플릿 3종을 복제하여 텍스트와 사진을 삽입하고 output 폴더에 저장한다.
---

# build-card-html

승인된 카드뉴스 컨텐츠를 HTML 파일 6개로 변환한다.
입력: 세트 ID + create-card-content 최종 확정 컨텐츠
출력: `output/{ID}/card-01.html` ~ `card-06.html`

---

## 파일 구조

```
cardnewscontent/
├── template_page1.html       ← 1페이지(표지) 템플릿
├── template_page2to5.html    ← 2~5페이지(본문) 공용 템플릿
├── template_page6.html       ← 6페이지(브랜드 마무리) 템플릿
├── input/
│   └── {ID}/                 ← 원본 이미지 + text.md 위치
└── output/
    └── {ID}/                 ← 생성 대상 폴더
        ├── card-01.html
        ├── card-02.html
        ├── card-03.html
        ├── card-04.html
        ├── card-05.html
        └── card-06.html
```

---

## 실행 전 준비

```bash
# 1. output 폴더 생성
mkdir -p output/{ID}

# 2. 이미지 절대 경로 확인 (file:// 형식으로 변환 필요)
ls input/{ID}/
# → 알파벳 순서대로 photo1~photo6에 매핑 (text.md 제외)
```

**이미지 경로 변환 규칙:**
```
상대 경로: input/0001/IMG_5709.jpeg
절대 경로: file:///Users/jayden/Desktop/done자동화/cardnewscontent/input/0001/IMG_5709.jpeg
```
`background-image: url('file:///...')` 형식으로 삽입해야 Playwright가 이미지를 렌더링할 수 있다.

---

## 템플릿별 교체 규칙

### card-01.html (template_page1.html 기반)

| 교체 대상 | 교체 값 |
|-----------|---------|
| `background-image: url('...')` in `.bg-image` | `file://` 절대경로 (photo1) |
| `<h1>` 내용 | 확정된 표지 제목 (`<br>` 줄바꿈 유지) |

**교체 전:**
```html
background-image: url('https://images.unsplash.com/...');
```
```html
<h1>대학생이 만든 로봇이<br>전세계 해양 오염을<br>해결하기까지</h1>
```

**교체 후:**
```html
background-image: url('file:///절대경로/input/0001/파일명.jpeg');
```
```html
<h1>확정된 제목<br>줄바꿈 있으면 유지</h1>
```

---

### card-02.html ~ card-05.html (template_page2to5.html 기반, 4개 개별 복사)

| 교체 대상 | 교체 값 |
|-----------|---------|
| `background-image: url('...')` in `.bg-image` | `file://` 절대경로 (photo2~5 순서대로) |
| `<h2 class="title">` 내용 | 해당 페이지 소제목 |
| `.paragraph` 블록 전체 | 아래 HTML 구조 참고 |

**단락 HTML 구조 (`.content` 안에 삽입):**

```html
<h2 class="title">소제목 텍스트</h2>

<div class="paragraph">
    <p>단락 1 첫 번째 문장</p>
    <p>단락 1 두 번째 문장 (있으면)</p>
</div>

<div class="paragraph">
    <p>단락 2 첫 번째 문장</p>
    <div>
        <span class="highlight">"하이라이트 문장"</span>
    </div>
    <p>단락 2 다음 문장 (있으면)</p>
</div>

<div class="paragraph">
    <p>단락 3 (있으면)</p>
</div>
```

**하이라이트 위치:** 하이라이트가 속한 단락의 앞뒤 문장 사이에 배치한다.
하이라이트가 마지막 문장이면 `</div>` 바로 앞에 배치한다.

**줄바꿈 처리:** create-card-content에서 `\n`으로 표시한 줄바꿈은 `<br>` 태그로 변환한다.

---

### card-06.html (template_page6.html 기반)

| 교체 대상 | 교체 값 |
|-----------|---------|
| `background-image: url('...')` in `.bg-image` | `file://` 절대경로 (photo6) |
| `<h1>D.ONE</h1>` | 변경 없음 (브랜드 고정) |
| `<p>DO YOUR ONE GOAL</p>` | 변경 없음 (브랜드 고정) |

6페이지는 배경 이미지만 교체하고 나머지 콘텐츠는 그대로 유지한다.

---

## 실행 순서

```
1. mkdir -p output/{ID}
2. Read template_page1.html → 수정 → Write output/{ID}/card-01.html
3. Read template_page2to5.html → 수정 (2페이지) → Write output/{ID}/card-02.html
4. Read template_page2to5.html → 수정 (3페이지) → Write output/{ID}/card-03.html
5. Read template_page2to5.html → 수정 (4페이지) → Write output/{ID}/card-04.html
6. Read template_page2to5.html → 수정 (5페이지) → Write output/{ID}/card-05.html
7. Read template_page6.html → 수정 (배경만) → Write output/{ID}/card-06.html
8. 완료 메시지 출력
```

템플릿은 매번 Read로 새로 읽고 Write로 별도 파일에 저장한다. 원본 템플릿은 절대 수정하지 않는다.

---

## 완료 출력 형식

```
✅ HTML 파일 6개 생성 완료

output/{ID}/
├── card-01.html  (표지)
├── card-02.html  (2페이지)
├── card-03.html  (3페이지)
├── card-04.html  (4페이지)
├── card-05.html  (5페이지)
└── card-06.html  (브랜드 마무리)

👉 PNG로 캡처할까요? (capture-card-png 실행)
```

---

## 흔한 실수와 해결책

| 실수 | 해결책 |
|------|--------|
| 이미지 경로를 상대경로로 넣었다 | `file:///` 절대경로로 변환 후 삽입 |
| text.md를 이미지로 매핑했다 | `ls input/{ID}/`에서 `.md` 파일 제외하고 이미지만 매핑 |
| 원본 템플릿을 수정했다 | 항상 새 파일에 Write, 템플릿은 Read 전용 |
| template_page2to5.html을 한 번만 읽고 재사용 | 4개 파일마다 Read → 수정 → Write 반복 |
| 6페이지 H1/p 내용을 바꿨다 | 6페이지 텍스트 콘텐츠는 변경 금지 |
| 하이라이트를 `<p>` 안에 넣었다 | `<div><span class="highlight">` 구조 사용 |
| `\n` 줄바꿈을 그대로 텍스트로 넣었다 | `<br>` 태그로 변환 |
