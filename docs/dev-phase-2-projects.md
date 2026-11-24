# Dev Phase 2 — Projects

목표: Presentation 앞에 **Projects** 탭을 두고, 프레젠테이션(프로젝트) 여러 개를 썸네일 목록으로 관리한다. 프로젝트를 새로 만들고, 복제하고, 제목을 바꾸고, 삭제한다. 프로젝트마다 Phase 1처럼 페이지 폴더를 따로 만들고 동기화한다. 프로젝트를 열면 지금의 Presentation(Dev Phase 1)에서 편집한다.

참조: [Dev Phase 1 — Presentation](dev-phase-1-presentation.md), 화면 참고는 파일 브라우저 화면(폴더 안 파일 카드 그리드).

> 상태: **구현**. 2026-11-22 작성, 2026-11-23 [확인한 사항](#확인한-사항)을 반영했고, 2026-11-24 2-1부터 2-13까지 구현·검증했다. 계획과 달라진 점과 검증은 [구현 결과](#구현-결과)에 있다.

## 요구 사항

| # | 요구 | 계획 위치 |
|---|---|---|
| R1 | Presentation 탭 앞에 Projects 탭을 추가하고, 앱 첫 화면을 Projects로 한다 | 2-4 |
| R2 | 프로젝트 여러 개를 썸네일 목록으로 관리한다 | 2-5 |
| R3 | 화면은 참고 화면(파일 브라우저)을 따른다 | [화면 설계](#화면-설계) |
| R4 | 프로젝트마다 페이지 폴더를 따로 만들고 동기화한다. 새 프로젝트가 생기면 그 프로젝트의 폴더들이 새로 생긴다 | 2-1, 2-3 |
| R5 | 카드 썸네일은 사용자가 고른 페이지다. 고르지 않으면 page 1이다 | 2-6 |
| R6 | 프로젝트를 추가할 수 있다. 새 프로젝트는 page 1이 유형 1, page 2~5는 빈 화면이다 | 2-7 |
| R7 | 프로젝트를 복제할 수 있다 | 2-8 |
| R8 | 프로젝트 제목을 바꿀 수 있다 | 2-9 |
| R9 | 프로젝트를 삭제할 수 있다 | 2-10 |
| R10 | 기존 프로젝트(`project 1`)의 제목은 `2026 브루넬 연말행사`다 | 2-1 |
| R11 | 배포 사이트에서도 만들기·복제·제목 변경·삭제를 허용한다. 그 브라우저에만 저장된다 | 2-11 |

## 범위

- 넣는 것: 프로젝트 목록(그리드·리스트), 새 프로젝트, 복제, 제목 바꾸기, 삭제, 썸네일 페이지 지정, 정렬, 프로젝트별 덱·페이지 폴더·썸네일, 기존 `project 1` 이전.
- 넣지 않는 것: 프로젝트를 묶는 정리 폴더, 공유, 권한, 서버 저장, 실시간 협업, 즐겨찾기, 유형 필터(참고 화면의 폴더 메뉴·Share·★·All types).
- 서버 없음은 그대로다. 파일 쓰기는 localhost 개발 서버에서만, 배포 사이트는 브라우저 저장만 쓴다.

## 화면 설계

### 참고 화면에서 가져올 것

| 참고 화면 요소 | Projects 탭 | 결정 |
|---|---|---|
| ‹ › 뒤로·앞으로 + 경로 | 브라우저 히스토리 뒤로·앞으로 + `Projects` | 채택 |
| 폴더 아이콘 + 큰 제목 | 아이콘 + `Projects` 제목, 옆에 `프로젝트 N개` | 변형: 정리 폴더가 없으므로 ▾ 메뉴는 두지 않는다 |
| `+ Create ▾` | `+ 새 프로젝트` 버튼 | 변형: 만들 것이 프로젝트 하나뿐이라 ▾ 없음 |
| `Last modified ▾` | 정렬: 최근 수정(기본)·이름·만든 날짜 | 채택 |
| 그리드·리스트 전환 | 그리드(기본)·리스트 | 채택 |
| 카드: 썸네일 + 아이콘 + 제목 + `Edited 9 days ago` | 카드: 썸네일 + 아이콘 + 제목 + `9일 전 수정` | 채택 |
| 카드 4열 | 화면 너비에 맞춰 열 수 자동(카드 최소 너비 약 280px) | 변형 |
| 카드 hover ★ | hover 시 ⋯ 메뉴 버튼(열기·제목 바꾸기·복제·삭제) | 변형 |
| `All types ▾` | — | 보류: 형식이 프레젠테이션 하나뿐이다 |
| `Share`, 설정 아이콘, ★ | — | 보류: 공유할 서버가 없다 |

색·글꼴·버튼은 참고 화면이 아니라 이 앱의 `tokens.css`·`base.css`를 쓴다. 라이트·다크 모드를 모두 맞춘다.

### 레이아웃

```text
┌─ AX DESIGN STUDIO ─────────── PROJECTS · PRESENTATION ─────────── 모드 · 설정 ─┐
│                                                                                │
│  ‹ ›  Projects                                                [+ 새 프로젝트]   │
│                                                                                │
│  ▣ Projects   프로젝트 3개                      [최근 수정 ▾]  [▦ 그리드|≡ 리스트] │
│                                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                          │
│  │           ⋯  │  │              │  │              │                          │
│  │  썸네일 페이지 │  │              │  │              │                          │
│  │   16 : 9     │  │              │  │              │                          │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤                          │
│  │ ◧ 2026 브루넬 │  │ ◧ 새 프로젝트  │  │ ◧ … 복사본    │                          │
│  │   연말행사     │  │   방금 수정    │  │   1시간 전 수정 │                          │
│  │   9일 전 수정  │  │              │  │              │                          │
│  └──────────────┘  └──────────────┘  └──────────────┘                          │
└────────────────────────────────────────────────────────────────────────────────┘
```

- **그리드 보기**: 16:9 썸네일 카드. 아래에 아이콘, 제목, 수정 시각.
- **리스트 보기**: 한 줄에 작은 썸네일, 제목, 페이지 수, 만든 날짜, 수정 시각.
- **빈 상태**: 프로젝트가 하나도 없으면 가운데에 `+ 새 프로젝트`.

### 동작

| 동작 | 결과 |
|---|---|
| 카드 클릭·Enter | 그 프로젝트를 Presentation에서 연다(`#/presentation/<projectId>`) |
| 제목 더블클릭·⋯ **제목 바꾸기** | 제목 입력. Enter 확정, Esc 취소. 빈 제목은 받지 않는다 |
| ⋯ **복제** | `<제목> 복사본`이 생긴다 |
| ⋯ **삭제** | 확인 대화상자 후 지운다 |
| `+ 새 프로젝트` | 새 프로젝트를 만들고 제목 입력 상태로 둔다 |
| 카드 우클릭 | ⋯ 메뉴와 같은 메뉴 |

- 수정 시각은 상대 시간으로 쓴다: `방금`, `N분 전`, `N시간 전`, `N일 전`, `N개월 전`, `N년 전` + `수정`.
- 정렬·보기 방식은 브라우저에 기억한다.
- Presentation 헤더 왼쪽에 `Projects / <프로젝트 제목>` 경로를 두어 목록으로 돌아갈 수 있게 한다.

## 정보 구조와 주소

| 주소 | 화면 |
|---|---|
| `#/projects` | 프로젝트 목록. **앱 첫 화면** |
| `#/presentation/<projectId>` | 그 프로젝트의 Presentation |
| `#/presentation` | 마지막으로 연 프로젝트. 없으면 `#/projects` |

- 네비: `Projects · Presentation` 순서.
- 주소 없이 열거나 알 수 없는 주소는 `#/projects`로 보낸다.

## 데이터 모델

```ts
type ProjectMeta = {
  id: string;                     // "project-1", 새 프로젝트는 "project-<uuid>"
  dir: string;                    // 디스크 폴더 이름 "project 1". 제목을 바꿔도 그대로
  title: string;                  // 화면 제목
  thumbnailPageId: string | null; // 썸네일 페이지. null이거나 그 페이지가 없으면 page 1
  createdAt: string;              // ISO 시각
  updatedAt: string;              // 덱을 저장할 때마다 갱신
};
```

- 덱은 Phase 1의 `PresentationDeck`을 그대로 쓴다. 프로젝트마다 덱 하나다.
- 썸네일 페이지는 순서(`page 3`)가 아니라 페이지 id로 기억한다. 페이지를 옮겨도 같은 페이지가 썸네일로 남는다.
- 페이지 id는 프로젝트 안에서만 유일하면 된다. 복제한 프로젝트는 페이지 id를 그대로 두고, 파일 경로에 프로젝트를 넣어 구분한다.
- 목록 순서는 정렬로만 정한다. 따로 순서 파일을 두지 않는다.

### 프로젝트별 폴더 (R4)

Phase 1은 `presentation/project 1/pages/page N/`에 페이지마다 폴더를 두고, 덱이 바뀌면 개발 서버가 폴더를 덱에 맞춘다(만들기·이름 맞추기·Conference 원본 복사). Phase 2는 이 구조를 프로젝트마다 둔다. 새 프로젝트가 생기면 `presentation/project N/`과 그 안의 페이지 폴더들이 새로 생기고, 그 프로젝트의 덱이 바뀌면 그 프로젝트의 폴더만 동기화한다.

```text
presentation/
  progressive-blur.js        # 지금과 같음
  project 1/                 # 2026 브루넬 연말행사
    project.json             # ProjectMeta (dir 제외)
    deck.json                # 기본 덱. 지금의 src/shared/presentation-defaults.json을 옮긴다
    thumbnail.webp           # 썸네일 페이지 렌더링 (960 × 540)
    pages/
      page 1/  page.json + 파일
      …
      page 18/
  project 2/                 # 새 프로젝트
    project.json
    deck.json                # 유형 1 + 빈 화면 4장
    thumbnail.webp
    pages/
      page 1/ … page 5/
```

- 앱은 빌드할 때 `import.meta.glob`으로 모든 `presentation/*/project.json`·`deck.json`·`thumbnail.webp`를 묶는다(`src/built-projects.ts`). localhost는 개발 서버가 `presentation/`을 감시하지 않으므로 `GET /__projects`로 디스크를 바로 읽는다.
- 기본값 세팅 두 버튼은 열린 프로젝트의 `deck.json`에 쓴다.
- 새 프로젝트의 폴더 이름은 `project N`(지금 가장 큰 N + 1)이다. 가운데 지운 번호는 채우지 않는다. 가장 큰 번호를 지우면 그 번호는 다음 프로젝트가 쓴다(id가 달라 브라우저 저장은 섞이지 않는다).

### 브라우저 저장

| 키 | 내용 |
|---|---|
| `ax-projects` (localStorage) | `created`(브라우저에서 만든 프로젝트와 그 페이지 파일을 읽을 프로젝트 `media`), `edits`(빌드에 든 프로젝트의 제목·썸네일 페이지, 모든 프로젝트의 작업 덱 수정 시각), `deleted`(이 브라우저에서 숨긴 빌드 프로젝트), `lastOpened` |
| `ax-project-deck:<projectId>` (localStorage) | 프로젝트별 작업 덱. 지금의 `ax-presentation-deck`을 대신한다 |
| `ax-project-thumbs` (IndexedDB) | 썸네일 캐시. 키는 프로젝트 id, 값은 썸네일 페이지 해시와 이미지 |
| `ax-projects-view` (localStorage) | 정렬·그리드/리스트 |

- localStorage는 약 5MB다. 덱 하나가 약 80KB이므로 수십 개까지는 괜찮다. 넘치면 덱 저장을 IndexedDB로 옮긴다(위험 R-1).
- 썸네일 이미지는 localStorage에 넣지 않는다.

### localhost와 배포 사이트

| 동작 | localhost | 배포 사이트 |
|---|---|---|
| 목록 | 디스크의 `presentation/*/project.json` | 빌드에 묶인 프로젝트 + 이 브라우저에서 만든 프로젝트 − 이 브라우저에서 지운 프로젝트 |
| 새 프로젝트·복제 | 디스크에 프로젝트 폴더와 페이지 폴더를 만든다 | 이 브라우저에만 저장(카드에 `이 브라우저에만 저장됨` 표시) |
| 제목·썸네일 페이지 | 디스크 `project.json`에 쓴다 | 이 브라우저에만 저장 |
| 삭제 | 디스크에서 프로젝트 폴더를 지운다 | 브라우저에서 만든 것은 지우고, 빌드에 든 것은 이 브라우저에서 숨긴다 |
| 썸네일 | 렌더링해서 `thumbnail.webp`로 저장 | 빌드에 든 `thumbnail.webp`. 브라우저에서 고친 덱이면 다시 렌더링 |
| 페이지 파일 올리기 | 그 프로젝트의 페이지 폴더 | Phase 1처럼 IndexedDB(`ax-studio-uploads`) |

## 썸네일 (R5)

- 카드 썸네일은 그 프로젝트의 **썸네일 페이지**를 Phase 1과 같은 렌더러(`renderStudioStill` + `presentationStudioConfig`)로 그린 것이다. 고르지 않았거나 고른 페이지를 지웠으면 **page 1**이다.
- 기존 `project 1`은 지금 page 1(`AI + DESIGN FUTURES` 표지), 새 프로젝트는 유형 1 디바이더가 기본 썸네일이다.
- **고르는 곳**: Presentation 페이지 레일의 페이지 우클릭 메뉴(지금 복사·잘라내기·붙여넣기·삭제)에 **썸네일로 지정**을 더한다. 이미 썸네일인 페이지에서는 **썸네일 지정 해제**(page 1로 돌아감)로 바뀐다. 지정한 페이지는 레일 썸네일 모서리에 작은 표시를 단다.
- 크기 960 × 540 WebP. 썸네일 페이지의 상태 해시가 같으면 캐시를 쓴다.
- 목록을 열면 캐시가 없는 카드만 차례로 렌더링한다(한 번에 하나, 화면에 보이는 카드부터). 그리는 동안 빈 자리와 제목을 먼저 보여 준다.
- `thumbnail.webp`는 `deck.json`의 썸네일 페이지를 그린 것이다. localhost에서는 기본값을 세팅하거나 썸네일 페이지를 바꾸거나 프로젝트를 만들·복제하면 다시 그려 쓴다. 파일이 `deck.json`·`project.json`보다 오래되면 낡은 것으로 보고, 목록을 열 때도 다시 쓴다. 빌드가 이 파일을 함께 묶으므로 배포 사이트는 카드 페이지가 `deck.json`의 그 페이지와 같으면 렌더링 없이 바로 보인다.

## 새 프로젝트 (R6)

- 페이지 5장: page 1은 `createTypedPage(1, …)`(저장된 유형 1 디바이더), page 2~5는 `createBlankPage(tone)`(다크는 검정, 라이트는 흰 바탕의 빈 화면).
- 제목은 `새 프로젝트`, 같은 이름이 있으면 `새 프로젝트 2`, `새 프로젝트 3`…
- localhost에서는 `presentation/project N/`을 만들고 `project.json`, `deck.json`, `pages/page 1~5/page.json`을 쓴다.
- 만든 뒤 목록에 남기고 제목 입력 상태로 둔다. 카드를 누르면 연다.

## 복제 (R7)

- 새 id, `<제목> 복사본`(있으면 `<제목> 복사본 2`…), 썸네일 페이지는 원본과 같다. 만든 시각·수정 시각은 지금.
- 덱은 사용자가 보고 있는 상태(브라우저 작업 덱이 있으면 그것, 없으면 `deck.json`)를 복사한다.
- localhost에서는 원본의 `pages/` 전체를 새 프로젝트 폴더로 복사한다. 같은 내용 파일은 git이 한 번만 저장하므로 저장소가 두 배로 커지지는 않는다. 디스크와 배포 번들은 커진다(위험 R-3).

## 제목 바꾸기 (R8)

- `title`만 바꾼다. 디스크 폴더 이름(`dir`)과 id는 그대로다.
- 카드 제목 더블클릭, ⋯ 메뉴에서 바꾼다.

## 삭제 (R9)

- ⋯ 메뉴 **삭제** → 확인 대화상자: `'<제목>' 프로젝트를 삭제할까요? 페이지 폴더의 그림·영상도 함께 지워집니다.` localhost에서는 `커밋하지 않은 파일은 되돌릴 수 없습니다.`를 덧붙인다.
- localhost: `presentation/<dir>/` 폴더 전체와 브라우저 작업 덱(`ax-project-deck:<id>`), 썸네일 캐시를 지운다.
- 배포 사이트: 위 [localhost와 배포 사이트](#localhost와-배포-사이트) 표대로.
- 마지막 프로젝트도 지울 수 있다. 그러면 빈 상태가 보이고, `#/presentation`은 `#/projects`로 간다.
- 지금 연 프로젝트였으면 `lastOpened`를 비운다.

## 페이지 폴더를 프로젝트 단위로

Phase 1은 `presentation/project 1/pages`를 코드에 고정해 두었다. 이것을 프로젝트별로 바꾼다.

| 지금 | 바꾼 뒤 |
|---|---|
| `scripts/presentation-project.ts`의 `PROJECT = presentation/project 1/pages` | 요청에 프로젝트 id를 받아 `presentation/<dir>/pages`를 찾는다 |
| `POST /__presentation-project` (덱 하나) | 본문에 `project`를 넣어 그 프로젝트의 폴더만 동기화 |
| `POST /__presentation-upload?page=&name=` | `?project=&page=&name=` |
| `/__presentation-media/<pageId>/<이름>` | `/__presentation-media/<projectId>/<pageId>/<이름>` |
| 배포 `presentation-media/<pageId>/<이름>` | `presentation-media/<projectId>/<pageId>/<이름>` |
| `presentationFileUrl(src)` | 열린 프로젝트 id를 함께 쓴다. `pres:<pageId>/<이름>` 형식은 그대로 |
| `scripts/build-site.ts`가 기본 덱 하나의 파일만 복사 | 모든 프로젝트 덱이 쓰는 파일과 `thumbnail.webp`를 복사 |
| `.cursor/skills/presentation-folder-sync` 등 | `project 1` 고정 설명을 프로젝트별로 고친다 |

## 개발 순서

| 단계 | 내용 |
|---|---|
| 2-1 | 데이터 모델과 `project 1` 이전(제목 `2026 브루넬 연말행사`) |
| 2-2 | 개발 서버 `/__projects` 경로 |
| 2-3 | 페이지 폴더·동기화·빌드를 프로젝트 단위로 |
| 2-4 | 네비·주소·첫 화면 |
| 2-5 | 목록 화면 |
| 2-6 | 썸네일과 썸네일 페이지 지정 |
| 2-7 | 새 프로젝트 |
| 2-8 | 복제 |
| 2-9 | 제목 바꾸기 |
| 2-10 | 삭제 |
| 2-11 | 배포 사이트 동작 |
| 2-12 | 테스트와 문서 |
| 2-13 | 원본 코드 정리 |

### 2-1 데이터 모델과 이전

계획: `src/shared/projects.ts`에 `ProjectMeta`와 순수 함수(새 프로젝트 덱, 복제, 제목, 삭제, 썸네일 페이지 결정, 정렬, 상대 시간, 이름 중복 번호)를 둔다. `src/shared/presentation-defaults.json`을 `presentation/project 1/deck.json`으로 옮기고, `project.json`(`title: "2026 브루넬 연말행사"`, `thumbnailPageId: null`)을 만든다. 브라우저의 `ax-presentation-deck`은 처음 열 때 한 번 `ax-project-deck:project-1`로 옮긴다.

검증: 이전 뒤 localhost와 배포 빌드에서 기존 18장 덱이 그대로 열린다. 예전 저장 덱이 있던 브라우저도 그 덱을 연다. 카드 제목이 `2026 브루넬 연말행사`다.

### 2-2 개발 서버 경로

계획: `scripts/projects.ts`에 `GET /__projects`(목록)와 `POST /__projects`(`create`·`duplicate`·`rename`·`delete`·`thumbnail-page`·`thumbnail`)를 둔다. id와 폴더 이름은 Phase 1의 `safeId`처럼 검사하고 `presentation/` 밖으로 나가지 못하게 한다. 삭제는 `presentation/project N/` 형태의 폴더만 지운다.

검증: 각 동작 뒤 디스크의 `project.json`·`deck.json`·폴더가 기대와 같다. 잘못된 id·경로는 400이고 아무것도 지우지 않는다.

### 2-3 페이지 폴더·동기화·빌드

계획: 위 [페이지 폴더를 프로젝트 단위로](#페이지-폴더를-프로젝트-단위로) 표대로 바꾼다. 동기화는 Phase 1과 같은 규칙(페이지 순서대로 `page 1`, `page 2`… 이름 맞추기, Conference 원본 복사)을 프로젝트마다 적용한다.

검증: 프로젝트 두 개에서 각각 페이지를 추가·이동·삭제하면 그 프로젝트의 `pages/` 폴더만 바뀐다. 두 프로젝트가 같은 페이지 id를 가져도 각자 자기 파일을 연다. 배포 빌드에서 모든 프로젝트의 그림·영상이 열린다.

### 2-4 네비·주소·첫 화면

계획: 헤더 네비를 `Projects · Presentation`으로, `src/router.ts`에 `projects`·`presentation/<id>`를 둔다. 첫 화면과 알 수 없는 주소는 `#/projects`다. 원본에서 남은 Graphic Library·Online Studio·Conference·History 경로는 이때 지운다. Presentation 헤더에 `Projects / <제목>` 경로를 둔다.

검증: 주소 없이 열면 Projects가 나온다. 탭 순서가 Projects → Presentation이다. 주소를 직접 쳐도 맞는 화면이 나오고, 뒤로·앞으로가 동작한다.

### 2-5 목록 화면

계획: `src/views/projects.ts`에 헤더(뒤로·앞으로·경로·새 프로젝트), 제목 줄(`Projects`, 개수, 정렬, 보기 전환), 카드 그리드·리스트, ⋯ 메뉴, 빈 상태를 둔다. 카드는 키보드로 포커스하고 Enter로 연다. 스타일은 `src/styles/projects.css`에 둔다.

검증: 라이트·다크에서 참고 화면과 같은 구성으로 보인다. 창을 줄이면 열 수가 줄어든다. 정렬·보기는 새로고침 뒤에도 유지된다.

### 2-6 썸네일과 썸네일 페이지 지정

계획: 위 [썸네일](#썸네일-r5) 방식. 렌더링 큐는 한 번에 하나만 돌린다. 레일 페이지 메뉴에 **썸네일로 지정**·**썸네일 지정 해제**를 더하고 지정 표시를 단다.

검증: 처음에는 page 1이 썸네일이다. page 3을 썸네일로 지정하고 Projects로 돌아오면 카드가 page 3이다. page 3을 다른 자리로 옮겨도 그대로, page 3을 지우면 page 1로 돌아간다. 18장 덱이어도 썸네일 페이지 하나만 렌더링한다.

### 2-7 새 프로젝트

계획: 위 [새 프로젝트](#새-프로젝트-r6) 방식.

검증: 새 프로젝트를 열면 page 1이 유형 1, page 2~5가 빈 화면인 5장이다. localhost에서는 `presentation/project 2/pages/page 1~5/`가 생긴다.

### 2-8 복제

계획: 위 [복제](#복제-r7) 방식.

검증: 복제본을 열면 원본과 같은 페이지·그림·영상이 나온다. 복제본을 고쳐도 원본은 그대로다. localhost에서 복제본의 `pages/` 폴더가 따로 생긴다.

### 2-9 제목 바꾸기

계획: 위 [제목 바꾸기](#제목-바꾸기-r8) 방식.

검증: 제목을 바꾸고 새로고침해도 유지된다. 디스크 폴더 이름은 그대로다.

### 2-10 삭제

계획: 위 [삭제](#삭제-r9) 방식.

검증: 확인을 취소하면 아무것도 지워지지 않는다. 확인하면 카드와 localhost의 프로젝트 폴더가 사라지고, 다른 프로젝트 폴더는 그대로다. 마지막 프로젝트를 지우면 빈 상태가 보인다.

### 2-11 배포 사이트

계획: 배포 사이트에서는 디스크 경로 대신 `ax-projects`·`ax-project-deck:<id>`만 쓴다. 브라우저에서 만든 프로젝트에는 `이 브라우저에만 저장됨`을 표시한다. 배포가 바뀌면 빌드에 든 프로젝트는 Phase 1처럼 새 기본 덱을 연다.

검증: 배포 사이트에서 새 프로젝트를 만들고, 복제하고, 제목을 바꾸고, 지운 뒤 새로고침해도 그대로다. 다른 브라우저에서는 보이지 않는다.

### 2-12 테스트와 문서

계획: `scripts/test-projects.ts`(새 프로젝트 5장 구성, 복제, 제목, 삭제, 썸네일 페이지 결정, 정렬, 상대 시간, 이름 번호, 이전)를 추가하고 `package.json`에 `test:projects`를 둔다. README, Dev Phase 1 문서의 경로 설명, `.cursor/skills`, 이 문서의 상태를 갱신한다.

검증: `npm run test:projects`, `test:studio`, `test:conference`, `tsc --noEmit`, `npm run build`가 통과한다.

### 2-13 원본 코드 정리

계획: AX-DESIGN-TOOL에서 딸려 와 Presentation·Projects가 쓰지 않는 코드를 지운다. 대상은 [Dev Phase 1의 남은 원본 코드](dev-phase-1-presentation.md#남은-원본-코드-정리-dev-phase-2의-2-13) 표에서 2-4가 정리한 `src/router.ts`를 뺀 나머지다. 2-12까지 테스트를 갖춘 뒤에 해야, 지운 뒤 기능이 깨졌는지 확인할 수 있다.

| 대상 | 정리 |
|---|---|
| `src/shared/studio-presets.ts`, `src/shared/studio-defaults.json`, `src/styles/presets/*.webp` | Online Studio 카드 크기 프리셋과 미리보기를 지운다 |
| `src/shared/conference-defaults.json`, `src/studio-baseline.ts` | Conference 프리셋 기준값·인스타그램 연사 카드 저장을 지운다. Presentation은 초기화 대신 기본값 세팅을 쓴다(P1-06) |
| `src/shared/conference.ts` | `conf-slide` 외 프리셋을 지운다. 페이지 폴더 동기화가 쓰는 `backgroundIdFor`·`speakerSlug`·`logoSlug`와 Conference 데이터 형식은 남긴다 |
| `src/shared/print-png.ts`, `src/shared/card-gif.ts` | Conference 인쇄 PNG·GIF 내보내기를 지운다. 한 장 PDF가 쓰는 `card-pdf.ts`는 남긴다 |
| `src/views/studio.ts` | Online Studio·Conference 분기(프리셋 고르기, 초기화, 인쇄·GIF·동영상 내보내기 등)를 지운다 |
| `scripts/test-studio.ts`, `scripts/test-conference.ts` | 지운 기능의 검사를 빼고, 남은 기능의 검사는 둔다 |
| `package.json` | 쓰지 않게 된 패키지(`omggif`, `pngjs`, `@types/pngjs`, `mediabunny`)를 확인해 뺀다 |
| `scripts/omggif.d.ts` | `omggif`를 빼면 함께 지운다 |
| `.gitignore` | `dist-internal/`, `dist-public/`, `reports/`, `[Graphic_Resources]/03_Slide/…mp4` 줄을 지운다 |

- 각 대상을 지우기 전에 Presentation·Projects 화면에서 쓰는지 import와 화면 동작으로 확인한다. 쓰는 것이 나오면 지우지 않고 문서에 이유를 적는다.
- 한 번에 지우지 않는다. 위 표의 한 줄씩 지우고, 그때마다 `tsc --noEmit`과 테스트를 돌린다.
- 끝나면 Dev Phase 1 문서의 정리 후보 표와 모듈 구성 표를 갱신한다.

검증: `tsc --noEmit`, 모든 테스트, `npm run build`가 통과한다. 지운 모듈을 가리키는 import가 없다. 빌드된 JS 번들이 작아진다. localhost와 배포 빌드에서 다음이 그대로 된다: Projects 목록과 모든 동작, Presentation 편집(도형·텍스트·이미지·영상·정렬), 페이지 폴더 올리기·동기화, 한 장 PNG·PDF, 덱 PDF·PPTX·Keynote·HTML 내보내기, 프레젠테이션 모드와 소리, ASSETS 탭, MCP 연결, 라이트·다크 모드, 리셋.

## 바뀔 파일

| 경로 | 변경 |
|---|---|
| `src/shared/projects.ts` | 새 파일. 모델과 순수 함수 |
| `src/projects-store.ts`, `src/built-projects.ts`, `src/views/project-thumbs.ts` | 새 파일(구현 중 나눔). 목록·덱 저장(localhost와 배포 사이트), 빌드에 든 프로젝트, 카드 썸네일 |
| `src/views/projects.ts`, `src/styles/projects.css` | 새 파일. 목록 화면 |
| `scripts/projects.ts` | 새 파일. `/__projects` 개발 서버 경로 |
| `scripts/test-projects.ts` | 새 파일. 테스트 |
| `src/main.ts` | 네비·주소·첫 화면·프로젝트 로드·마지막 연 프로젝트 |
| `src/router.ts` | 새 주소, 원본 경로 정리 |
| `src/shared/presentation.ts` | 덱 저장 키·기본 덱을 프로젝트별로 |
| `src/shared/presentation-files.ts`, `src/views/presentation-project.ts` | 프로젝트 id를 넣은 파일 경로·동기화 |
| `src/views/presentation.ts` | `Projects / <제목>` 경로, 레일 메뉴 **썸네일로 지정** |
| `scripts/presentation-project.ts`, `scripts/build-site.ts`, `vite.config.ts` | 프로젝트별 페이지 폴더·기본값·빌드 |
| `presentation/project 1/` | `project.json`, `deck.json`, `thumbnail.webp` 추가 |
| `src/shared/presentation-defaults.json` | `presentation/project 1/deck.json`으로 이동 |
| `.cursor/skills/*` | 프로젝트별 폴더 설명 |
| `src/views/studio.ts`, `src/shared/conference.ts`, 원본 전용 파일들, `package.json`, `.gitignore` | 2-13 원본 코드 정리 |

## 위험

| ID | 위험 | 대응 |
|---|---|---|
| R-1 | 프로젝트가 많아지면 localStorage(약 5MB)가 찬다 | 덱이 커지면 IndexedDB로 옮긴다. 저장 실패 시 토스트로 알린다 |
| R-2 | 목록을 열 때 썸네일 렌더링이 무겁다 | 썸네일 페이지만, 하나씩, 캐시. localhost는 파일로 저장해 배포에서는 렌더링하지 않는다 |
| R-3 | 복제가 페이지 파일을 통째로 복사해 디스크와 배포 번들이 커진다(`project 1`의 배포 파일 약 104MB) | 빌드가 1GB 한도를 검사한다. 필요하면 같은 내용 파일을 한 번만 복사하도록 바꾼다 |
| R-4 | 기존 저장 덱·주소(`#/presentation`)가 깨질 수 있다 | 2-1에서 한 번 옮기고, `#/presentation`은 마지막 프로젝트로 연다 |
| R-5 | localhost 삭제는 디스크 폴더를 지우므로 커밋하지 않은 그림·영상은 되돌릴 수 없다 | 확인 대화상자에 적고, 서버는 `presentation/project N/` 형태만 지운다 |
| R-6 | 2-13에서 `studio.ts`(약 386KB)의 공유 코드를 원본 전용으로 잘못 보고 지울 수 있다 | 한 줄씩 지우고 매번 타입 검사·테스트, 마지막에 검증 목록을 화면에서 확인한다 |

## 구현 결과

2026-11-24 구현. 단계마다 계획의 검증을 자동 검사(`npm run test:projects` 등)와 헤드리스 Chrome으로 localhost 개발 서버·빌드 미리보기(`vite preview`, 배포 사이트와 같은 동작)에서 확인했다.

| 단계 | 결과 |
|---|---|
| 2-1 | `presentation/project 1/project.json`(`2026 브루넬 연말행사`)·`deck.json`(예전 `src/shared/presentation-defaults.json`). 예전 `ax-presentation-deck`은 처음 열 때 `ax-project-deck:project-1`로 옮긴다. 18장 덱이 그대로 열린다 |
| 2-2 | `scripts/projects.ts`: `GET /__projects`, `GET /__projects/<id>/thumbnail.webp`, `POST /__projects`(`create`·`duplicate`·`rename`·`delete`·`thumbnail-page`·`thumbnail`·`deck`). 잘못된 id·경로·제목·덱은 400이고 아무것도 지우지 않는다 |
| 2-3 | 페이지 폴더 경로에 프로젝트 id(`?project=`, `/__presentation-media/<projectId>/…`, 배포 `presentation-media/<projectId>/…`). 한 프로젝트의 덱을 바꾸면 그 프로젝트 폴더만 바뀌고, 같은 페이지 id를 가진 복제본도 각자 자기 파일을 연다. 빌드는 프로젝트마다 `deck.json`이 쓰는 파일을 복사한다 |
| 2-4 | 네비 `Projects · Presentation`, 첫 화면·알 수 없는 주소 `#/projects`, `#/presentation`은 마지막 프로젝트, 헤더 `Projects / <제목>`. 원본 경로는 지웠다 |
| 2-5 | `src/views/projects.ts`, `src/styles/projects.css`: 뒤로·앞으로·경로·새 프로젝트, 제목·개수·정렬·그리드/리스트, ⋯·우클릭 메뉴, 빈 상태. 정렬·보기는 새로고침 뒤에도 유지된다 |
| 2-6 | 레일 페이지 메뉴 **썸네일로 지정·썸네일 지정 해제**와 모서리 표시. 카드는 고른 페이지(옮겨도 그대로, 지우면 page 1). 카드 썸네일은 한 번에 하나, 화면에 보이는 카드부터 그리고 IndexedDB `ax-project-thumbs`에 상태 해시로 둔다 |
| 2-7 | `+ 새 프로젝트`: 유형 1 + 빈 화면 4장, 제목 입력 상태. localhost에 `project N/pages/page 1~5/`가 생긴다 |
| 2-8 | `<제목> 복사본`. localhost는 `pages/`를 통째로 복사하고, 복제본을 고쳐도 원본은 그대로다 |
| 2-9 | 제목 더블클릭·⋯ 메뉴. Enter 확정, Esc 취소, 빈 제목은 받지 않는다. 폴더 이름은 그대로다 |
| 2-10 | 확인 대화상자(localhost는 `커밋하지 않은 파일은 되돌릴 수 없습니다.` 덧붙임). 취소하면 그대로, 확인하면 그 폴더만 지운다. 마지막 프로젝트를 지우면 빈 상태다 |
| 2-11 | 배포 사이트: 만들기·복제·제목·삭제가 그 브라우저에만 남고(`이 브라우저에만 저장됨`), 다른 브라우저에는 보이지 않는다. 새 배포의 덱이 바뀌면 빌드에 든 프로젝트는 새 기본 덱을 연다 |
| 2-12 | `scripts/test-projects.ts`(`npm run test:projects`), README·Dev Phase 1 문서·`.cursor/skills` 갱신 |
| 2-13 | [Dev Phase 1의 원본 코드 정리](dev-phase-1-presentation.md#남은-원본-코드-정리-dev-phase-2의-2-13). `card-gif.ts`·`mediabunny`·`omggif`는 Presentation의 영상 페이지 내보내기가 써서 남겼다. 주 JS 묶음 458.79kB → 418.33kB |

### 계획을 구체화한 결정

| ID | 결정 |
|---|---|
| P2-11 | localhost는 프로젝트 목록과 덱을 `GET /__projects`로 읽고, 배포 사이트는 빌드에 묶인 것을 쓴다. 덱·썸네일·`project.json` 쓰기는 모두 `/__projects`로 한다. Phase 1의 `/__presentation-defaults`는 없앴다 |
| P2-12 | 작업 덱을 고친 수정 시각은 브라우저(`ax-projects`)에 두고, 디스크 `project.json`의 `updatedAt`은 `deck.json`을 쓸 때(만들기·복제·기본값 세팅)만 바꾼다. 편집할 때마다 `project.json`이 바뀌어 git에 잡히지 않게 한다. 카드는 둘 중 늦은 시각을 보인다 |
| P2-13 | `thumbnail.webp`가 최신인지는 파일 시각이 `deck.json`·`project.json`보다 늦은지로 본다. 작업 덱의 썸네일 페이지가 `deck.json`과 다르면 `deck.json`의 그 페이지를 따로 그려 쓴다 |
| P2-14 | 배포 사이트에서 빌드에 든 프로젝트를 복제하면 복제본의 페이지 파일은 원본 프로젝트의 복사본(`presentation-media/<원본 id>/`)을 읽는다(`media`) |
| P2-15 | **리셋**은 빌드·디스크에 든 프로젝트의 작업 덱을 지워 각자의 `deck.json`으로 돌아간다. 배포 사이트에서 이 브라우저로 만든 프로젝트는 작업 덱이 곧 프로젝트라 그대로 둔다 |
| P2-16 | 다른 프로젝트를 열면 복사해 둔 페이지(클립보드)를 비운다. 페이지 파일이 프로젝트 폴더마다 따로 있어 다른 프로젝트에 붙이면 그림이 깨지기 때문이다. 유형 복사는 남는다 |
| P2-17 | 개발 서버 경로는 `npm run dev`의 localhost에서만 쓴다. 빌드를 localhost에서 미리 볼 때(`vite preview`)도 배포 사이트처럼 동작한다 |
| P2-18 | 카드 제목을 한 번 누르면 250ms 기다렸다가 열고, 그 사이 두 번 누르면 제목 바꾸기로 들어간다(레일 페이지 이름과 같은 방식) |
| P2-19 | 레일 페이지 메뉴는 페이지 목록을 실제로 스크롤할 때만 닫는다. 선택하지 않은 페이지를 우클릭하면 화면을 다시 그리면서 편집 영역이 가운데로 스크롤되어 메뉴가 바로 닫히던 Phase 1 문제를 고쳤다(**썸네일로 지정**에 필요) |

### 알려진 제약

- 배포 사이트에서는 페이지 폴더에 파일을 올릴 수 없다(Phase 1과 같다).
- 배포 사이트에서 빌드에 든 프로젝트를 지우면 그 브라우저에서 숨길 뿐이고, 되살리는 메뉴는 없다(브라우저 저장소를 지우면 다시 보인다).
- localStorage(약 5MB)에 작업 덱이 프로젝트마다 약 80KB 쌓인다. 저장하지 못하면 토스트로 알린다(R-1).
- 복제는 페이지 파일을 통째로 복사해 디스크와 배포 묶음이 커진다(R-3, `project 1`의 배포 파일 약 104MB).

## 확인한 사항

2026-11-23 사용자 답변.

| # | 질문 | 답 |
|---|---|---|
| Q1 | "프로젝트들은 따로 폴더링"의 뜻 | 지금 페이지마다 폴더가 생기고 동기화되듯, 새 프로젝트가 생기면 그 프로젝트에 맞는 폴더들이 새로 생겨야 한다. 정리 폴더는 아니다 |
| Q2 | 썸네일 페이지 | 고르는 기능을 넣는다. 고르지 않으면 page 1 |
| Q3 | 삭제·복제·제목 변경 | 셋 다 넣는다 |
| Q4 | 앱 첫 화면 | Projects |
| Q5 | 기존 `project 1`의 제목 | `2026 브루넬 연말행사` |
| Q6 | 배포 사이트에서 만들기·복제 등 | 허용(그 브라우저에만 저장) |

## 결정 기록

| ID | 결정 |
|---|---|
| P2-01 | 프로젝트 하나 = 덱 하나 = 디스크 폴더 하나(`presentation/<dir>/`)이고, 그 안에 페이지 폴더를 따로 둔다. |
| P2-02 | 제목은 `project.json`의 `title`만 바꾼다. 디스크 폴더 이름과 id는 바꾸지 않는다. |
| P2-03 | 프로젝트를 묶는 정리 폴더는 넣지 않는다. |
| P2-04 | 카드 썸네일은 고른 페이지, 없으면 page 1을 Phase 1 렌더러로 그린 것이다. 고르는 곳은 레일 페이지 메뉴다. |
| P2-05 | 새 프로젝트는 유형 1 page 1 + 빈 page 2~5, 모두 5장이다. |
| P2-06 | 페이지 파일 경로에 프로젝트 id를 넣고, `pres:` 형식은 바꾸지 않는다. |
| P2-07 | 앱 첫 화면은 Projects(`#/projects`)다. |
| P2-08 | 배포 사이트에서도 만들기·복제·제목·삭제를 허용하고, 그 브라우저에만 저장한다. |
| P2-09 | 참고 화면의 Share·★·All types·폴더 메뉴는 넣지 않는다. |
| P2-10 | 원본 코드 정리는 Phase 2 마지막(2-13)에, 테스트를 갖춘 뒤 한 대상씩 한다. |
