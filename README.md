# AX-DESIGN-TOOL-Presentation

[AX-DESIGN-TOOL](https://github.com/woongs2021/AX-DESIGN-TOOL)의 **Presentation 탭만** 떼어 낸 프로젝트다. 3840 × 2160 슬라이드 덱을 편집하고, 프레젠테이션 모드로 발표하고, PDF·PPTX·HTML로 내보낸다. 2026-11-22 AX-DESIGN-TOOL `main`(`9ed1064`)의 Presentation 탭과 같은 화면·덱·에셋·기능을 담았고, Obsidian 기반 그래픽 라이브러리(ASSETS 탭)만 뺐다.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173/
```

페이지 영상의 소리는 Chrome에서 확인한다. VS Code 내장 브라우저는 AAC 오디오를 재생하지 못한다.

## 기능

- **덱 편집**: 페이지 추가·복제·이동·삭제, 유형 1·2·3, 도형·선·펜·텍스트·이미지·영상 레이어, 정렬·분배, 블러·투명도·모서리, 레이어 등장(프로그레시브 블러)
- **페이지 폴더**(localhost): 각 페이지의 이미지·영상은 `presentation/project 1/pages/page N/`에 있고 컨트롤 패널 **이 페이지**에 보인다. + 버튼, 끌어다 놓기, 붙여넣기로 넣은 파일은 그 폴더에 저장된다.
- **기본값 세팅**(localhost): **단일 페이지 / 전체 페이지 현상태 기본값으로 세팅**이 `src/shared/presentation-defaults.json`에 쓴다. 이 파일이 기본 덱이다.
- **프레젠테이션 모드**: 전체 화면 발표, 영상 소리 재생과 소리 버튼(스피커 아이콘)
- **내보내기**: 벡터 PDF, 편집 가능한 PPTX(Keynote), HTML(영상·소리·블러 등장 포함)
- **MCP 연결**: `figma-plugin/`과 연결해 카드를 Figma 페이지에 넣는다.
- 라이트·다크 모드, **설정 → 리셋**(브라우저에 저장된 덱을 지우고 기본 덱으로 돌아간다)

배포된 사이트는 새로 배포될 때마다 그 배포의 기본 덱을 보여 준다. 같은 배포 안에서 브라우저에서 한 편집은 유지되고, localhost는 작업 중인 덱을 그대로 쓴다.

## 폴더

| 경로 | 내용 |
|---|---|
| `src/` | 앱. `main.ts`(Presentation만 보여 준다), `views/presentation.ts`, `views/studio.ts`(편집기), `shared/` |
| `src/shared/presentation-defaults.json` | 기본 덱(18장) |
| `presentation/project 1/pages/` | 페이지 폴더(이미지·영상과 `page.json`) |
| `presentation/progressive-blur.js` | 프로그레시브 블러 등장 효과 |
| `public/data/conference.json` | Conference 배경·연사·로고 목록 |
| `public/assets/conference/` | Conference 에셋(배경 이미지·영상, 연사 사진, 로고) |
| `phase 2-resources/` | 페이지 폴더 동기화가 폴더에 복사하는 Conference 원본(연사 사진·로고·배경) |
| `scripts/` | dev 서버 경로(`presentation-project.ts`), Figma 브리지, 빌드, 테스트 |
| `.cursor/skills/` | 페이지 폴더 동기화, 에셋 정리, 모션 작업 안내 |

`public/`의 데이터와 에셋은 AX-DESIGN-TOOL에서 `npm run build:site -- --target=public`으로 만든 `dist/public` 가운데 Conference 부분만 옮긴 것이다. Conference 에셋을 바꾸려면 AX-DESIGN-TOOL에서 다시 빌드해 `public/data/conference.json`과 `public/assets/conference/`를 교체한다.

가볍게 쓰려고 Obsidian 시스템(vault와 그것으로 만드는 그래픽 라이브러리 `index.json`·이미지)은 넣지 않았다. 그래서 편집기의 ASSETS 탭(그래픽 라이브러리)은 나타나지 않는다. 그래픽 라이브러리 원본은 [Hermes-project-assets Releases](https://github.com/woongs2021/Hermes-project-assets/releases)에 있다.

## 빌드·테스트

```bash
npm run build            # dist/app 정적 사이트. 기본 덱이 쓰는 페이지 폴더 파일을 presentation-media/로 함께 복사한다
npm run preview
npm run test:studio
npm run test:conference
```
