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
- `data/diseases.json` — 병해 63개 (`id`, `name`, `host`(기주), `crop`(작물 구분), `pathogen`(병원), `features`, `images`). 사진은 `images/disease/{3자리 id}/`
- `data/pairs.json` — 헷갈리는 쌍(비교 탭) 목록과 구분 포인트
- `data/credits.json` — iNaturalist에서 추가한 사진의 촬영자·라이선스·원본 링크
- `images/{3자리 id}/01.jpg …` — 잡초별 사진. 추가·삭제하면 `weeds.json`의 `images`와 `credits.json`도 함께 고친다.

## 사진 기준

- 꽃·열매·이삭·잎 모양 중 하나라도 뚜렷한 사진만 쓴다.
- 멀리서 찍은 군락·풍경, 여러 풀이 뒤섞인 사진, 잎만 빽빽한 사진은 넣지 않는다.
- PDF에서 가져온 원본 사진(출처가 `credits.json`에 없는 사진)은 지우지 않는다.

## 확인 방법

```bash
python3 -m http.server 8000   # http://localhost:8000
```
