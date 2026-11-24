# AX-DESIGN-TOOL-Presentation

Pages: [https://woongs2021.github.io/AX-DESIGN-TOOL-Presentation/](https://woongs2021.github.io/AX-DESIGN-TOOL-Presentation/)

[AX-DESIGN-TOOL](https://github.com/woongs2021/AX-DESIGN-TOOL)의 **Presentation 탭만** 떼어 낸 프로젝트다. 3840 × 2160 슬라이드 덱을 편집하고, 프레젠테이션 모드로 발표하고, PDF·PPTX·HTML로 내보낸다. 첫 화면 **Projects**에서 덱(프로젝트) 여러 개를 썸네일 카드로 관리하고, 하나를 열면 **Presentation**에서 편집한다. 2026-11-22 AX-DESIGN-TOOL `main`(`9ed1064`)의 Presentation 탭과 같은 화면·덱·에셋·기능을 담았다. 그래픽 라이브러리(ASSETS 탭)는 빌드된 목록만 담았고, 이미지는 [AX-DESIGN-TOOL 배포 사이트](https://woongs2021.github.io/AX-DESIGN-TOOL/)에서 불러온다. 목록을 만드는 Obsidian vault는 넣지 않았다.

## 개발 단계

| 단계 | 내용 | 상태 | 문서 |
|---|---|---|---|
| Dev Phase 1 — Presentation | 덱 하나의 편집·발표·내보내기, 페이지 폴더, 기본값 세팅, 그래픽 라이브러리, GitHub Pages 배포 | 구현 | [docs/dev-phase-1-presentation.md](docs/dev-phase-1-presentation.md) |
| Dev Phase 2 — Projects | 앱 첫 화면이 되는 Projects 탭(Presentation 앞). 프로젝트 여러 개를 썸네일 카드로 관리하고(썸네일 페이지 지정, 기본 page 1), 새로 만들기(유형 1 + 빈 화면 4장)·복제·제목 바꾸기·삭제. 프로젝트마다 페이지 폴더를 따로 만들고 동기화한다. 마지막에 원본에서 딸려 온 코드를 정리한다(2-13) | 구현 | [docs/dev-phase-2-projects.md](docs/dev-phase-2-projects.md) |

Dev Phase 1 문서는 화면 구성, 데이터 모델, 저장 위치, 개발 서버 경로, 모듈 구성, 빌드·배포, 원본에서 정리한 것을 담는다. Dev Phase 2 문서는 참고 화면(파일 브라우저)을 바탕으로 한 화면 설계, 프로젝트별 폴더 구조, localhost와 배포 사이트의 동작 차이, 단계별 계획·검증과 구현 결과, 확인한 사항을 담는다.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173/
```

페이지 영상의 소리는 Chrome에서 확인한다. VS Code 내장 브라우저는 AAC 오디오를 재생하지 못한다.

## 기능

- **Projects**(첫 화면, `#/projects`): 프로젝트를 썸네일 카드(그리드·리스트)로 보여 준다. 정렬(최근 수정·이름·만든 날짜)과 보기 방식은 브라우저에 기억한다. **+ 새 프로젝트**(유형 1 + 빈 화면 4장), 카드 ⋯·우클릭 메뉴의 열기·제목 바꾸기·복제·삭제, 제목 더블클릭으로 이름 바꾸기. 카드를 누르면 그 프로젝트를 Presentation에서 연다(`#/presentation/<projectId>`).
- **썸네일 페이지**: 카드 썸네일은 고른 페이지, 고르지 않았으면 page 1이다. Presentation 페이지 레일의 우클릭 메뉴 **썸네일로 지정**·**썸네일 지정 해제**로 고르고, 고른 페이지는 레일 썸네일 모서리에 표시가 붙는다.
- **덱 편집**: 페이지 추가·복제·이동·삭제, 유형 1·2·3, 도형·선·펜·텍스트·이미지·영상 레이어, 정렬·분배, 블러·투명도·모서리, 레이어 등장(프로그레시브 블러)
- **페이지 폴더**(localhost): 각 페이지의 이미지·영상은 `presentation/<프로젝트 폴더>/pages/page N/`에 있고 컨트롤 패널 **이 페이지**에 보인다. + 버튼, 끌어다 놓기, 붙여넣기로 넣은 파일은 그 폴더에 저장된다. 프로젝트마다 폴더가 따로 있고, 그 프로젝트의 덱이 바뀌면 그 프로젝트의 폴더만 맞춘다.
- **기본값 세팅**(localhost): **단일 페이지 / 전체 페이지 현상태 기본값으로 세팅**이 열린 프로젝트의 `deck.json`에 쓴다. 이 파일이 그 프로젝트의 기본 덱이다. `thumbnail.webp`도 함께 갱신한다.
- **프레젠테이션 모드**: 전체 화면 발표, 영상 소리 재생과 소리 버튼(스피커 아이콘)
- **내보내기**: 벡터 PDF, 편집 가능한 PPTX(Keynote), HTML(영상·소리·블러 등장 포함)
- **MCP 연결**: `figma-plugin/`과 연결해 카드를 Figma 페이지에 넣는다.
- 라이트·다크 모드, **설정 → 리셋**(브라우저에 저장된 작업 덱을 지우고 각 프로젝트의 기본 덱으로 돌아간다. 배포 사이트에서 이 브라우저로 만든 프로젝트는 그대로 둔다)

localhost에서 만든·복제한·이름을 바꾼·지운 프로젝트는 `presentation/` 폴더에 바로 반영된다(지우면 그 프로젝트 폴더가 지워진다). 배포된 사이트에서도 같은 동작을 할 수 있지만 그 브라우저에만 저장되고(카드에 `이 브라우저에만 저장됨`), 빌드에 든 프로젝트를 지우면 그 브라우저에서만 숨긴다. 배포된 사이트는 새로 배포될 때마다 빌드에 든 프로젝트의 기본 덱을 보여 준다. 같은 배포 안에서 브라우저에서 한 편집은 유지되고, localhost는 작업 중인 덱을 그대로 쓴다.

## 폴더

| 경로 | 내용 |
|---|---|
| `src/` | 앱. `main.ts`(네비·주소·첫 화면), `views/projects.ts`(Projects 목록), `views/presentation.ts`, `views/studio.ts`(편집기), `projects-store.ts`(프로젝트 목록과 덱 저장), `shared/` |
| `presentation/project N/` | 프로젝트 하나. `project.json`(id·제목·썸네일 페이지·만든/수정 시각), `deck.json`(기본 덱), `thumbnail.webp`(카드 썸네일), `pages/page N/`(페이지 폴더: 이미지·영상과 `page.json`) |
| `presentation/project 1/` | `2026 브루넬 연말행사`(18장). Dev Phase 1의 덱 |
| `presentation/progressive-blur.js` | 프로그레시브 블러 등장 효과 |
| `public/data/conference.json` | Conference Slide 배경·연사·로고 목록 |
| `public/assets/conference/` | Conference 에셋(Slide 배경 이미지·영상, 연사 사진, 로고) |
| `public/data/index.json` | 그래픽 라이브러리 목록(ASSETS 탭, 64점). 이미지는 AX-DESIGN-TOOL 배포 사이트의 `assets/captures/`에서 불러온다 |
| `phase 2-resources/` | 페이지 폴더 동기화가 폴더에 복사하는 Conference 원본(연사 사진·로고·Slide 배경) |
| `scripts/` | dev 서버 경로(`projects.ts`, `presentation-project.ts`), Figma 브리지, 빌드, 테스트 |
| `docs/` | 개발 단계 문서(Dev Phase 1·2) |
| `.cursor/skills/` | 페이지 폴더 동기화, 에셋 정리, 모션 작업 안내 |

`public/`의 데이터와 에셋은 AX-DESIGN-TOOL에서 `npm run build:site -- --target=public`으로 만든 `dist/public`을 옮긴 것이다. 바꾸려면 AX-DESIGN-TOOL에서 다시 빌드해 Conference는 `public/data/conference.json`과 `public/assets/conference/`를, 그래픽 라이브러리는 `public/data/index.json`을 교체한다. Presentation은 Slide 배경만 쓰므로, Conference를 교체한 뒤 Instagram·Poster·배너 배경 파일과 `conference.json`의 그 항목은 지운다.

그래픽 라이브러리 이미지는 저장소에 넣지 않았다. 앱이 `index.json`의 경로 앞에 AX-DESIGN-TOOL 배포 사이트 주소(`src/main.ts`의 `LIBRARY_ORIGIN`)를 붙여 불러온다. 그 사이트는 CORS를 허용하므로 라이브러리 이미지를 쓴 카드도 PNG·PDF·PPTX로 내보낼 수 있다. 그래서 그 사이트에 같은 경로의 이미지가 배포되어 있어야 하고, `index.json`을 교체할 때는 AX-DESIGN-TOOL도 같은 빌드로 배포되어 있어야 한다. GitHub 릴리즈 파일은 CORS를 허용하지 않아 내보내기가 막히므로 직접 연결하지 않는다. `public/data/index.json`이 없으면 ASSETS 탭은 나타나지 않는다. 그래픽 라이브러리 원본은 [Hermes-project-assets Releases](https://github.com/woongs2021/Hermes-project-assets/releases)에 있다.

## 빌드·테스트

```bash
npm run build            # dist/app 정적 사이트. 프로젝트마다 deck.json이 쓰는 페이지 폴더 파일을 presentation-media/<projectId>/로 함께 복사한다
npm run preview
npm run test:projects
npm run test:studio
npm run test:conference
```

## 배포

GitHub Pages가 `gh-pages` 브랜치의 루트를 서비스한다. 자동 배포는 없다. 커밋한 상태에서 저장소 루트에서 아래를 실행해 `dist/app`을 `gh-pages`에 올린다. 작업 중인 브랜치와 파일은 바뀌지 않는다.

```bash
npm run build
touch dist/app/.nojekyll
git fetch origin gh-pages
export GIT_INDEX_FILE="$PWD/.git/gh-pages.index"
rm -f "$GIT_INDEX_FILE"
git --work-tree=dist/app add -A
commit=$(git commit-tree "$(git write-tree)" -p origin/gh-pages -m "Deploy the Presentation site to GitHub Pages.")
rm -f "$GIT_INDEX_FILE"
unset GIT_INDEX_FILE
git push origin "$commit:gh-pages"
```

푸시하면 Pages가 1분 안팎으로 다시 빌드한다. 몇 분이 지나도 사이트가 바뀌지 않으면 빌드를 직접 요청한다.

```bash
gh api -X POST repos/woongs2021/AX-DESIGN-TOOL-Presentation/pages/builds
gh api repos/woongs2021/AX-DESIGN-TOOL-Presentation/pages/builds/latest -q .status   # built가 나오면 끝
```
