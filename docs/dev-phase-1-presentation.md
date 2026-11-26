# Dev Phase 1 — Presentation

목표: 3840 × 2160 슬라이드 덱 하나를 편집하고, 프레젠테이션 모드로 발표하고, PDF·PPTX·Keynote·HTML로 내보낸다. AX-DESIGN-TOOL의 Presentation 탭을 떼어 내 이 저장소의 첫 단계로 삼았다.

> 상태: **구현**. 2026-11-22 기준. AX-DESIGN-TOOL `main`(`9ed1064`)의 Presentation 탭을 옮기고, 그래픽 라이브러리(ASSETS 탭)를 원본 배포 사이트에 연결해 GitHub Pages에 배포했다. 덱은 하나(`presentation/project 1`)뿐이었다. 여러 프로젝트 관리는 [Dev Phase 2 — Projects](dev-phase-2-projects.md)에서 다룬다.
>
> 2026-11-24 Dev Phase 2에서 경로가 프로젝트 단위로 바뀌었다. 이 문서의 경로·저장 키·개발 서버 경로는 바뀐 뒤를 적는다: 기본 덱은 `src/shared/presentation-defaults.json`에서 `presentation/project 1/deck.json`으로, 작업 덱은 `ax-presentation-deck`에서 `ax-project-deck:<projectId>`로, 페이지 파일 주소에는 프로젝트 id가 들어간다. 편집 화면과 기능은 그대로다.

## 범위

- 입력: Conference 데이터(Slide 배경·연사·로고), 그래픽 라이브러리 목록, 페이지 폴더의 이미지·영상, 스튜디오 레이어 모델.
- 출력: 페이지별 PNG, 덱 전체 PDF·PPTX(Keynote 포함)·HTML, Figma 페이지로 보내기(MCP 연결).
- 서버·LLM 호출 없음. 합성·렌더링·내보내기는 모두 브라우저 안에서 한다.
- 파일을 쓰는 기능(기본값 세팅, 페이지 폴더)은 로컬 개발 서버(`npm run dev`)에서만 동작한다.

## 실행 환경

| 항목 | localhost (`npm run dev`) | 배포 사이트 (GitHub Pages) |
|---|---|---|
| 주소 | http://localhost:5173/ | https://woongs2021.github.io/AX-DESIGN-TOOL-Presentation/ |
| 덱 | 브라우저에 저장된 작업 덱을 그대로 연다 | 배포마다 그 배포의 기본 덱을 연다. 같은 배포 안의 브라우저 편집은 유지 |
| 기본값 세팅 | 열린 프로젝트의 `presentation/<폴더>/deck.json`에 쓴다 | 안 됨(로컬 서버에서만 가능하다고 안내) |
| 페이지 폴더 | `presentation/<폴더>/pages/page N/`을 읽고 쓴다 | 빌드가 복사한 `presentation-media/<projectId>/`를 읽기만 한다 |
| 올린 그림 | 페이지 폴더에 저장 | 안 됨(페이지 폴더가 없어 저장하지 못했다고 안내). 예전에 브라우저 IndexedDB(`ax-studio-uploads`)에 올린 그림은 읽는다 |
| Figma 브리지 | `127.0.0.1:47321`이 함께 뜬다 | 없음 |

## 화면 구성

```text
┌─ AX DESIGN STUDIO ──────────────── PRESENTATION ─────────────── 모드 · 설정 ─┐
├────────────┬──────────────────────┬───────────────────────────────────────────┤
│ 유형 1·2·3  │ DESIGN · CODE · ASSETS│  선택·도형·선·펜·텍스트 · 정렬·분배        │
│ 샘플        │                      │  페이지 추가 · 전체 다운로드 · 발표 모드    │
│────────────│ 배경(이미지·동영상)    │                                           │
│ page 1     │ 크기 · 카드 컬러       │        3840 × 2160 슬라이드 프리뷰          │
│ page 2     │ 이 페이지(페이지 폴더) │                                           │
│ page 3 …   │ 레이어별 속성          │                                           │
│ (페이지 레일)│ 기본값 세팅 두 버튼    │ 되돌리기 · 줌 · Fit · MCP · PDF · PNG      │
└────────────┴──────────────────────┴───────────────────────────────────────────┘
```

- **헤더**: 워드마크, `Projects / <프로젝트 제목>` 경로, `Projects · Presentation · Motions` 네비, 라이트·다크 전환, 설정(리셋). Phase 1에는 `Presentation` 하나뿐이었다. `Projects`는 Dev Phase 2, `Motions`는 Dev Phase 3에서 더했다.
- **페이지 레일**(왼쪽): 위에 유형 1·2·3 샘플, 아래에 페이지 썸네일과 이름. 레일 너비와 열림 상태는 브라우저에 저장한다.
- **컨트롤 패널**(가운데): `Design`(배경·크기·색·레이어 속성·페이지 폴더·기본값 세팅), `Code`(HTML+CSS 조각 붙여 넣기와 현재 디자인을 코드로 복사), `Assets`(그래픽 라이브러리 64점).
- **도구 막대**(위): 선택, 원·사각형·삼각형·별, 선, 펜, 텍스트, 정렬 6종·분배 2종, 페이지 추가, 전체 다운로드, 프레젠테이션 모드.
- **하단 막대**: 되돌리기·다시 실행, 줌·Fit, MCP 연결, PDF 다운로드(한 장), PNG 다운로드(한 장).

## 기능

### 페이지와 덱

- 유형: **유형 1**은 사진·디바이더(저장된 `presentation-type1.json`), **유형 2**는 다크 타이틀·단어, **유형 3**은 라이트 아젠다·모자이크(저장된 `presentation-type3.json`). 앱 라이트·다크 모드에 따라 유형 2·3의 글자·바탕색이 바뀐다. 유형 1은 그림을 유지한다.
- 페이지 추가·복제·삭제·이름 바꾸기(더블클릭)·끌어서 순서 바꾸기. 마지막 한 장은 지울 수 없다.
- Shift+클릭 범위 선택, 블록 끌기, Cmd+X·C·V 잘라내기·복사·붙여넣기, Delete 삭제.
- 되돌리기: 슬라이드 안 편집은 페이지별 스튜디오 히스토리, 페이지 추가·삭제·이동·이름은 덱 히스토리(Cmd+Z).

### 슬라이드 편집 (스튜디오)

- 레이어: 도형(원·사각형·삼각형·별)·선·펜·텍스트·이미지·영상. 정렬·분배, 그룹·잠금, Option 드래그 복사, Shift 축 고정.
- 효과: 블러·투명도·모서리, 그림자·블렌드·그라데이션·테두리, 이미지 밝기·대비·채도·색조, 레이어 등장(프로그레시브 블러, `presentation/progressive-blur.js`).
- 디자인 시스템 색 스와치: 클릭 순간 `src/shared/tokens.css`의 현재 모드 값을 읽어 적용한다.
- 배경: Conference `slide` 배경의 이미지·동영상, 또는 페이지 폴더의 파일.

### 페이지 폴더 (localhost)

- 페이지마다 `presentation/<프로젝트 폴더>/pages/page N/` 폴더가 있고(`project 1`이 Phase 1의 덱), `page.json`이 페이지 id(`page-01` 등)와 배치된 파일 목록(`placed`)을 가진다.
- 컨트롤 패널 **이 페이지**에 그 폴더 파일만 보인다. + 버튼, 끌어다 놓기, 붙여넣기로 넣은 파일은 그 폴더에 저장된다. 목록에서 지우면 폴더에서도 지운다.
- 덱이 바뀌면 브라우저가 페이지 목록을 개발 서버에 보내 폴더를 맞춘다(동기화). 이때 Conference 연사·로고·Slide 배경을 쓰는 페이지는 `phase 2-resources/`의 원본을 자기 폴더로 복사한다.
- 레이어는 페이지 파일을 `pres:<pageId>/<파일 이름>`으로 가리킨다. localhost에서는 `/__presentation-media/<projectId>/…`, 배포 사이트에서는 `presentation-media/<projectId>/…`로 읽는다.

### 기본값 세팅 (localhost)

- **단일 페이지 현상태 기본값으로 세팅**: 기본 덱에서 같은 id의 페이지를 지금 상태로 바꾼다. 새 페이지면 바로 앞 페이지 다음에 끼운다.
- **전체 페이지 현상태 기본값으로 세팅**: 덱 전체를 기본 덱으로 쓴다.
- 둘 다 `POST /__projects`(`action: "deck"`)로 열린 프로젝트의 `deck.json`을 다시 쓴다. 이 파일이 그 프로젝트의 기본 덱이다(`project 1`은 18장). Phase 1에서는 `POST /__presentation-defaults`가 `src/shared/presentation-defaults.json`에 썼다.

### 프레젠테이션 모드

- 전체 화면 발표. →·↓·Space·PageDown 다음, ←·↑·Backspace·PageUp 이전, Home·End 처음·끝, Esc 종료.
- 페이지 영상은 소리와 함께 재생한다. 브라우저가 소리를 막으면 음소거로 재생하고 소리 버튼(스피커 아이콘)을 띄운다. VS Code 내장 브라우저는 AAC 소리를 내지 못하므로 Chrome에서 확인한다.

### 내보내기

| 형식 | 방식 |
|---|---|
| PNG (한 장) | 캔버스 렌더링 |
| PDF (덱) | 벡터 PDF. Fontsource TrueType을 서브셋으로 넣어 한글을 선택·복사할 수 있다. 사진은 JPEG+마스크 |
| PowerPoint·Keynote | 페이지를 장면(`SlideScene`)으로 그려 편집 가능한 PPTX로 묶는다. Keynote도 같은 PPTX를 연다 |
| HTML | 슬라이드 SVG·서브셋 폰트·영상(base64)을 한 파일에. 화살표·Space·클릭·F·`#n`으로 넘기고 현재 장의 영상만 재생, 블러 등장 포함 |

라이브러리 그림처럼 다른 출처의 이미지는 CORS 모드(`crossOrigin = "anonymous"`)로 불러와 내보내기 캔버스가 막히지 않게 한다.

### 그래픽 라이브러리 (ASSETS 탭)

- 목록은 `public/data/index.json`(64점), 이미지는 AX-DESIGN-TOOL 배포 사이트(`https://woongs2021.github.io/AX-DESIGN-TOOL/assets/captures/…`)에서 불러온다. 그 사이트가 CORS를 허용한다.
- 목록 파일이 없으면 ASSETS 탭이 나타나지 않고 나머지는 그대로 동작한다.

### MCP 연결 (Figma)

- `npm run dev`가 Figma 브리지(`scripts/figma-bridge.ts`, `127.0.0.1:47321`)를 함께 띄운다.
- `figma-plugin/`을 Figma에서 실행해 두고, **MCP 연결**에 Figma 페이지 URL을 넣으면 카드를 그 페이지에 넣는다. URL은 브라우저(`ax-figma-page-url`)에 기억한다.

## 데이터 모델

```ts
type PresentationDeck = { selected: number; pages: PresentationPage[] };

type PresentationPage = {
  id: string;                         // page-01 … 또는 page-<uuid>
  type: 1 | 2 | 3;                    // 유형
  tone: "light" | "dark" | null;      // 유형 2·3의 톤. 유형 1은 null
  role: "divider" | "content" | "eod";
  state: StudioState;                 // 스튜디오 레이어 상태 (presetId "conf-slide", 3840 × 2160)
  name: string;                       // 레일 이름. 비면 page 1, page 2 …
  thumb: string;                      // 메모리 안 미리보기. 저장하지 않는다
};
```

- 저장 형식은 `{ version: 3, defaults, selected, pages }`다. `defaults`는 기본 덱의 해시(`DEFAULTS_STAMP`)로, 배포 사이트에서 기본 덱이 바뀌면 예전 저장 덱 대신 새 기본 덱을 연다.
- 이미지 레이어의 `src`: `pres:<pageId>/<이름>`(페이지 폴더), `conf:<id>`(Conference 연사·로고), 그래픽 라이브러리 slug, `upload:<id>`(브라우저 업로드).

## 저장 위치

| 위치 | 키·경로 | 내용 |
|---|---|---|
| localStorage | `ax-project-deck:<projectId>` | 프로젝트별 작업 덱. Phase 1의 `ax-presentation-deck`은 처음 열 때 `ax-project-deck:project-1`로 옮긴다 |
| localStorage | `ax-design-studio-mode` | 라이트·다크 |
| localStorage | `ax-presentation-rail`, `ax-presentation-rail-open`, `ax-presentation-sample`, `ax-presentation-controls` | 레일 너비·열림, 유형 샘플, 패널 너비 |
| localStorage | `ax-figma-page-url` | MCP 연결 Figma 페이지 |
| IndexedDB | `ax-studio-uploads` | 브라우저에 올린 그림 |
| 파일 | `presentation/project 1/deck.json` | 기본 덱(18장). 프로젝트마다 `deck.json`이 있다 |
| 파일 | `src/shared/presentation-type1.json`, `presentation-type3.json` | 유형 1·3 새 페이지 원본 |
| 파일 | `presentation/<프로젝트 폴더>/pages/page N/` | 페이지 폴더(파일과 `page.json`) |
| 파일 | `public/data/conference.json`, `public/assets/conference/` | Slide 배경, 연사 4명, 로고 12개 |
| 파일 | `public/data/index.json` | 그래픽 라이브러리 목록 |

## 시작 순서

1. `src/main.ts`가 `./data/conference.json`을 읽는다(최대 20번, 400ms 간격). 그동안 브라우저 업로드와 그래픽 라이브러리 목록도 읽는다.
2. 프로젝트 목록을 읽는다(Dev Phase 2). 프로젝트를 열면 `loadPresentationDeck`이 그 프로젝트의 저장 덱을 열고, 없거나 오래되었으면 그 프로젝트의 기본 덱을 연다.
3. `renderPresentation`이 레일과 스튜디오를 그리고, `bindPresentation`이 이벤트를 붙인다. 주소는 `#/presentation/<projectId>`다. Phase 1에서는 항상 `#/presentation`이었다.

## 로컬 개발 서버 경로

| 경로 | 메서드 | 역할 | 정의 |
|---|---|---|---|
| `/__projects` | GET·POST | 프로젝트 목록, 만들기·복제·제목·삭제·썸네일·기본 덱 쓰기(Dev Phase 2). Phase 1의 `/__presentation-defaults`를 대신한다 | `scripts/projects.ts` |
| `/__presentation-project` | POST | 본문의 `project` 하나의 페이지 폴더 동기화, 배치 표시, 파일 삭제 | `scripts/presentation-project.ts` |
| `/__presentation-upload?project=&page=&name=` | POST | 페이지 폴더에 파일 저장(100MB 이하) | `scripts/presentation-project.ts` |
| `/__presentation-media/<projectId>/<pageId>/<이름>` | GET | 페이지 폴더 파일 제공 | `scripts/presentation-project.ts` |
| `http://127.0.0.1:47321` | — | Figma 브리지 | `scripts/figma-bridge.ts` |

## 모듈 구성

| 경로 | 역할 |
|---|---|
| `src/main.ts` | 시작, 헤더(네비·경로), 주소, 모드·리셋, 데이터 읽기, 그래픽 라이브러리 연결 |
| `src/views/projects.ts`, `src/styles/projects.css` | Projects 목록(Dev Phase 2) |
| `src/projects-store.ts`, `src/built-projects.ts`, `src/shared/projects.ts`, `src/views/project-thumbs.ts` | 프로젝트 목록·덱 저장·빌드에 든 프로젝트·모델·카드 썸네일(Dev Phase 2) |
| `src/views/presentation.ts` | 페이지 레일(썸네일로 지정 포함), 유형 샘플, 다중 선택, 덱 히스토리, 프레젠테이션 모드, 내보내기 대화상자 |
| `src/views/presentation-project.ts` | 페이지 폴더 클라이언트(동기화·업로드·삭제) |
| `src/views/studio.ts` | 스튜디오 편집기(캔버스 렌더링, 레이어, 패널, 도구, 한 장 PNG·PDF, 영상 페이지의 동영상·GIF) |
| `src/shared/presentation.ts` | 덱 모델, 유형별 페이지, 프로젝트별 저장·기본값, 페이지 이동·삭제 |
| `src/shared/presentation-files.ts` | `pres:` 경로, 개발 서버 경로 상수 |
| `src/shared/studio.ts`, `studio-shapes.ts` | 스튜디오 상태 모델, 도형 |
| `src/shared/conference.ts` | Conference 데이터 계약, `conf-slide` 프리셋, 동기화 이름 규칙, 동영상 크기 |
| `src/shared/card-pdf.ts`, `card-gif.ts` | 한 장 PDF, 영상 페이지 GIF |
| `src/shared/slides-pptx.ts`, `scene-pdf.ts`, `scene-html.ts`, `font-files.ts` | PPTX·PDF·HTML 내보내기, 폰트 서브셋 |
| `src/shared/index-types.ts` | 그래픽 라이브러리 목록 형식 |
| `src/studio-uploads.ts` | 예전 브라우저 업로드(IndexedDB) 읽기. 새 파일은 페이지 폴더로 간다 |
| `src/feedback.ts` | 확인 대화상자, 토스트, MCP 연결 대화상자 |
| `scripts/projects.ts` | 프로젝트 개발 서버 경로(`/__projects`, Dev Phase 2) |
| `scripts/presentation-project.ts` | 프로젝트별 페이지 폴더 개발 서버 경로 |
| `scripts/figma-bridge.ts`, `figma-plugin/` | Figma 브리지와 플러그인 |
| `scripts/build-site.ts` | 정적 사이트 빌드(프로젝트별 페이지 파일 복사) |
| `presentation/progressive-blur.js` | 프로그레시브 블러 등장 효과 |

## 외부 의존

- 폰트: Fontsource CDN(`cdn.jsdelivr.net/fontsource`)의 Pretendard·Montserrat·Roboto TrueType. PDF·HTML 서브셋에 쓴다.
- 그래픽 라이브러리 이미지: AX-DESIGN-TOOL GitHub Pages.
- 패키지: `vite`, `typescript`, `tsx`, `mediabunny`(영상 페이지의 **동영상** MP4), `omggif`(영상 페이지의 **GIF 다운로드**와 그 테스트). `pngjs`(인쇄 PNG 테스트)는 Dev Phase 2의 2-13에서 뺐다.

## 빌드·배포·테스트

- `npm run build`: `tsc --noEmit` 후 Vite가 `dist/app`을 만든다. 프로젝트마다 `deck.json`이 쓰는 페이지 폴더 파일을 `dist/app/presentation-media/<projectId>/`로 복사하고, 번들이 GitHub Pages 한도(1GB)를 넘으면 실패한다. 2026-11-22 기준 약 256MB, 원본 정리 뒤 2026-11-24 기준 약 145MB다.
- 배포: `dist/app`을 `gh-pages` 브랜치에 올린다. 절차는 README의 **배포**에 있다. 자동 배포는 없다.
- 테스트: `npm run test:projects`(프로젝트 모델·저장·개발 서버 폴더·주소, Dev Phase 2), `npm run test:studio`(스튜디오 크기·폰트·잉크·코드·도형·GIF), `npm run test:conference`(Slide 프리셋·이름 규칙·영상 크기·덱 저장·순서·이동·삭제·기본값 병합).

## 원본에서 정리한 것

2026-11-22에 Presentation이 쓰지 않는 원본 파일을 지웠다.

| 지운 것 | 이유 |
|---|---|
| `public/assets/conference/backgrounds/`의 Instagram·Poster·L배너·X배너 이미지·영상·썸네일(11개, 약 106MB)과 `conference.json`의 해당 항목 | Presentation은 `conf-slide` 프리셋 하나만 쓰므로 `slide` 배경만 쓴다 |
| `phase 2-resources/[Graphic_Resources] 2/`의 `01_Instagram`·`02_Poster`·`04_Banner`(약 106MB) | 페이지 폴더 동기화는 `slide` 배경만 복사한다 |
| `docs/phase-3-presentation.md` | 원본의 Phase 3 문서. 없는 문서·탭을 가리켰고, 결정 기록은 이 문서로 옮겼다 |

### 남은 원본 코드 정리 (Dev Phase 2의 2-13)

아래는 Phase 1 때 코드가 import해서 파일만 지울 수 없던 원본 코드다. `src/router.ts`는 [Dev Phase 2](dev-phase-2-projects.md)의 2-4에서, 나머지는 2-13 **원본 코드 정리**에서 한 줄씩 지우고 그때마다 타입 검사와 테스트를 돌렸다(2026-11-24).

| 대상 | 결과 |
|---|---|
| `src/router.ts` | 지움: Graphic Library·Online Studio·Conference·History 경로. 지금은 `#/projects`, `#/presentation/<projectId>`만 있다 |
| `src/shared/studio-presets.ts`, `studio-defaults.json`, `src/styles/presets/*.webp` | 지움. 프리셋 형식(`StudioPreset`)과 크기 없는 저장 카드의 기본 크기(1080 × 1080)만 `src/shared/studio.ts`로 옮겼다 |
| `src/shared/conference-defaults.json`, `src/studio-baseline.ts` | 지움. 편집기의 인스타그램 연사 카드 넘기기·순서와 초기화 함수(`resetStudioState`, `applyStudioBaseline`)도 함께 지웠다 |
| `src/shared/conference.ts`의 Slide 외 프리셋 | 지움. `conf-slide`, Conference 데이터 형식, 동기화가 쓰는 `backgroundIdFor`·`speakerSlug`·`logoSlug`, 동영상 크기(`videoExportSizes`)는 남겼다 |
| `src/shared/print-png.ts` | 지움. `conf-slide`는 인쇄 크기가 없어 **인쇄용 PNG**가 나타나지 않았다 |
| `src/shared/card-gif.ts` | **남김**. 배경이 영상인 페이지(예: `project 1`의 page 2)에서 **GIF 다운로드**가 이것을 쓴다 |
| `src/views/studio.ts` | Online Studio·Conference 분기를 지움: 프리셋 고르기, 디바이스 뷰, 초기화·초기화로 세팅·그래픽 라이브러리에 추가, 브라우저 업로드 목록·삭제, 인쇄 PNG. 영상 페이지의 **동영상**·**GIF 다운로드**와 재생·일시정지 버튼은 Presentation이 쓰므로 남겼다. 편집기 설정의 `id`는 `"presentation"` 하나다 |
| `package.json` | `pngjs`, `@types/pngjs`를 뺐다. `mediabunny`(동영상 MP4)와 `omggif`(GIF)는 위 내보내기가 쓰므로 남겼고, `scripts/omggif.d.ts`도 남겼다 |
| `.gitignore`의 `dist-internal/`, `dist-public/`, `reports/`, `[Graphic_Resources]/03_Slide/…mp4` | 지움. 디스크에 없는 원본 빌드 경로였다 |

정리 뒤 빌드의 주 JS 묶음은 458.79kB(gzip 136.36kB)에서 418.33kB(gzip 126.42kB)로 줄었다.

아직 남은 것(정리 표에 없던 원본 코드, 지우지 않고 적어 둔다): `src/shared/filter.ts`의 `EMPTY_FILTER`·`computeFacetCounts`·`facetTotal`(그래픽 라이브러리 정렬 `sortCaptures`만 쓴다), `src/shared/studio.ts`의 `DEFAULT_THEME_SLUG`·`imageBlurCss`·`setStudioTheme`·`inkContrast`(테스트만 쓴다), `src/shared/presentation.ts`의 `retargetPage`, `src/styles/base.css`의 프리셋·디바이스 뷰·연사 순서 스타일, 영상 파일 이름의 `ax-conference-` 접두어.

## 결정 기록

| ID | 결정 |
|---|---|
| P1-01 | 페이지 크기는 3840 × 2160 하나다(`conf-slide`). (원본 P3-01) |
| P1-02 | 기본값 세팅은 브라우저가 아니라 저장소의 기본 덱 파일에 쓴다(Phase 1 `presentation-defaults.json`, Phase 2부터 프로젝트의 `deck.json`). 로컬 개발 서버에서만 기록한다. (원본 P3-02) |
| P1-03 | HTML은 한 파일에 영상·폰트·그림을 넣고, 글자를 임베드해 선택·검색할 수 있게 한다. (원본 P3-03) |
| P1-04 | PowerPoint와 Keynote는 같은 편집 가능 PPTX를 쓴다. (원본 P3-04) |
| P1-05 | 범위 선택은 Shift+클릭이다. Cmd+클릭 가산 선택은 넣지 않는다. (원본 P3-05) |
| P1-06 | Presentation 패널에는 초기화·그래픽 라이브러리 추가 대신 기본값 세팅 두 버튼만 둔다. (원본 P3-06) |
| P1-07 | 페이지 파일은 페이지 폴더에 두고 `pres:` 경로로 가리킨다. 배포 사이트에는 기본 덱이 쓰는 파일만 복사한다. |
| P1-08 | 배포 사이트는 배포마다 그 배포의 기본 덱을 보여 준다. localhost는 작업 덱을 유지한다. |
| P1-09 | 그래픽 라이브러리 이미지는 저장소에 넣지 않고 AX-DESIGN-TOOL 배포 사이트에서 CORS로 불러온다. GitHub 릴리즈 파일은 CORS를 허용하지 않아 쓰지 않는다. |
| P1-10 | 배포는 사람이 명령으로 한다. `dist/app`을 `gh-pages` 브랜치에 올린다. |
