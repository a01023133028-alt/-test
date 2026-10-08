# 잡초 사진 퀴즈

대학 잡초 식별(77종)·병해 식별(63개) 시험 대비용 정적 사이트. HTML + CSS + 바닐라 JS, 빌드 도구 없음.
GitHub Pages(`main` 브랜치, `/` 루트)로 배포되며 `main`에 머지되면 자동 재배포된다.

## 작업 규칙

- **사용자에게 하는 모든 답변은 무슨 일이 있어도 한국어로 쓴다.** 작업 보고, 오류·실패 설명, 백그라운드 작업 알림에 대한 답, 짧은 진행 상황 한 줄까지 예외 없다.
- 화면 문구·README·커밋 메시지·PR 설명도 한국어로 쓴다.
- **작업이 끝나면 묻지 말고 PR을 만들어 `main`에 머지까지 한다.**
  - 머지 전에 브라우저(모바일 390px 폭)로 동작과 사진 로딩을 확인한다.
  - 이미 머지된 브랜치에 이어서 작업할 때는 최신 `main`에서 다시 시작한다.

## 구조

- `index.html`, `css/style.css`, `js/*.js` — 화면과 로직 (`js/app.js`가 시작점)
- `js/subject.js` — 과목 설정. 잡초(기본)와 병해(`?s=disease`)가 같은 화면 코드를 쓰고, 문구·데이터 파일·분류 기준만 여기서 갈린다. 과목별 문구를 화면 코드에 직접 쓰지 않는다.
- `data/weeds.json` — 77종 데이터 (`id`, `name`, `morph`, `life`, `features`, `images`)
- `data/diseases.json` — 병해 63개 (`id`, `name`, `host`(기주), `crop`(작물 구분), `pathogen`(병원: 곰팡이(병꼴균·접합균·자낭균·담자균·불완전균)/난균류/세균/파이토플라스마/바이러스/바이로이드 — 6강 강의자료 기준), `features`, `images`). 사진은 `images/disease/{3자리 id}/`
- 암기 체크는 localStorage `mastered`(과목별)에 저장되고, `Quiz.pool`이 `opts.skipMastered`가 켜져 있으면 제외한다.
- `data/pairs.json` — 헷갈리는 쌍(비교 탭) 목록과 구분 포인트
- `data/credits.json` — iNaturalist에서 추가한 사진의 촬영자·라이선스·원본 링크
- `images/{3자리 id}/01.jpg …` — 잡초별 사진. 추가·삭제하면 `weeds.json`의 `images`와 `credits.json`도 함께 고친다.

## 디자인

- 초록 기반. 색은 `css/style.css` 맨 위 토큰(`--primary`, `--primary-strong`(입체 버튼 아래 테두리), `--primary-soft`, `--hero`(초록 그라데이션) 등)만 고치고, 라이트·다크(두 군데) 값을 함께 바꾼다.
- 글꼴은 Pretendard Variable(jsdelivr npm CDN). 버튼·카드는 아래 테두리 4px 입체 버튼, 둥근 카드(18~24px), 그림자 최소. 개편 규칙은 `style.css` 끝의 "디자인 개편" 블록에 있다.

## 배포 캐시

- `index.html`의 CSS·JS 주소 끝 `?v=날짜+문자`(예: `?v=20261008a`)는 브라우저 캐시 무효화용이다. **`css/`나 `js/` 파일을 고치면 반드시 이 값을 모두 함께 올린다.** 안 올리면 휴대폰이 예전 JS를 계속 써서 새 화면이 안 나온다.
- 같은 값을 루트의 `version.json`(`{ "v": "..." }`)에도 넣는다. 앱이 시작할 때 이 파일과 자기 버전을 비교해, 다르면(휴대폰이 예전 index.html을 캐시한 경우) 주소에 `?u=버전`을 붙여 한 번 새로 불러온다.

## 사진 기준

- 꽃·열매·이삭·잎 모양 중 하나라도 뚜렷한 사진만 쓴다.
- 멀리서 찍은 군락·풍경, 여러 풀이 뒤섞인 사진, 잎만 빽빽한 사진은 넣지 않는다.
- PDF에서 가져온 원본 사진(출처가 `credits.json`에 없는 사진)은 지우지 않는다.

## 확인 방법

```bash
python3 -m http.server 8000   # http://localhost:8000
```
