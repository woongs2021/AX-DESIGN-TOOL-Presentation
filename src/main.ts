import "./shared/tokens.css";
import "./styles/base.css";
import "./styles/projects.css";
import "./styles/motions.css";
import type { ConferenceIndex } from "./shared/conference.ts";
import type { SiteIndex } from "./shared/index-types.ts";
import { loadUploads } from "./studio-uploads.ts";
import { loadMotionFiles } from "./motion-assets.ts";
import { loadMotionDefaults } from "./motion-defaults.ts";
import { findMotionPreset, motionPresetsOf } from "./motions/index.ts";
import { readMotionsMemory } from "./motions-store.ts";
import type { MotionKind } from "./shared/motions.ts";
import { syncGraphicLibrary } from "./views/studio.ts";
import { confirmProceed, showToast } from "./feedback.ts";
import { hrefFor, onRouteChange, parseHash, type Route } from "./router.ts";
import { bindPresentation, releasePresentationMenu, renderPresentation, type DeckProject } from "./views/presentation.ts";
import { bindProjects, releaseProjectsMenu, renderProjects } from "./views/projects.ts";
import { bindMotions, releaseMotions, renderMotions } from "./views/motions.ts";
import { refreshDiskThumb } from "./views/project-thumbs.ts";
import { BUILT_PROJECTS } from "./built-projects.ts";
import {
  findProject,
  lastOpened,
  loadProjects,
  projectDeck,
  projectsOnDisk,
  resetDecks,
  saveProjectDeck,
  setLastOpened,
  setThumbnailPage,
  writeProjectDefaults,
  type Project,
} from "./projects-store.ts";
import { defaultPresentationDeck, defaultsWithPage, recolorBarePages, syncPresentationMode, type PresentationDeck } from "./shared/presentation.ts";

const MODE_KEY = "ax-design-studio-mode";
/** Conference backgrounds, speakers, and logos the slides are built from. */
const CONFERENCE_URL = "./data/conference.json";
/** Graphic library for the editor's ASSETS tab. Without it the tab is not shown. */
const INDEX_URL = "./data/index.json";
/** The library images are not in this repo; AX-DESIGN-TOOL's Pages site serves them (with CORS). */
const LIBRARY_ORIGIN = "https://woongs2021.github.io/AX-DESIGN-TOOL/";
const HOME = hrefFor({ name: "projects" });

type Mode = "light" | "dark";
type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string; hint: string }
  | { status: "ready"; conference: ConferenceIndex };

let loadState: LoadState = { status: "loading" };
/** The screen on show: the project list, one project in the Presentation tab, or one preset in the Motions tab. */
let view: { name: "projects" } | { name: "presentation"; project: string } | { name: "motions"; kind: MotionKind; preset: string } = { name: "projects" };

function readStoredMode(): Mode {
  const stored = localStorage.getItem(MODE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

function applyMode(mode: Mode): void {
  document.documentElement.dataset.theme = "cool";
  document.documentElement.dataset.mode = mode;
  localStorage.setItem(MODE_KEY, mode);
}

function navLink(label: string, href: string, current: boolean): string {
  return `<a class="nav-link${current ? " nav-link--current" : ""}" href="${href}" ${current ? 'aria-current="page"' : ""}>${label}</a>`;
}

function settingsIcon(): string {
  return `
    <svg class="mode-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
      <path d="M19.4 13.1a7.7 7.7 0 0 0 .05-2.2l1.8-1.4-2-3.4-2.2.7a8 8 0 0 0-1.9-1.1L14.6 3h-5.2l-.55 2.7a8 8 0 0 0-1.9 1.1l-2.2-.7-2 3.4 1.8 1.4a7.7 7.7 0 0 0 .05 2.2l-1.8 1.4 2 3.4 2.2-.7a8 8 0 0 0 1.9 1.1l.55 2.7h5.2l.55-2.7a8 8 0 0 0 1.9-1.1l2.2.7 2-3.4-1.8-1.4Z" />
    </svg>
  `;
}

function modeToggleIcon(mode: Mode): string {
  if (mode === "dark") {
    return `
      <svg class="mode-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2.5v3M12 18.5v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2.5 12h3M18.5 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
      </svg>
    `;
  }
  return `
    <svg class="mode-icon mode-icon--moon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3A7 7 0 0 0 21 12.8Z" />
    </svg>
  `;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function openProject(): Project | undefined {
  return view.name === "presentation" ? findProject(view.project) : undefined;
}

function shell(mainHtml: string): string {
  const mode = readStoredMode();
  const nextModeLabel = mode === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환";
  const project = openProject();
  const crumb = project
    ? `<nav class="nav-crumb" aria-label="경로"><a class="nav-crumb__link" href="${HOME}">Projects</a><span class="nav-crumb__sep" aria-hidden="true">/</span><span class="nav-crumb__current" aria-current="page" title="${escapeHtml(project.meta.title)}">${escapeHtml(project.meta.title)}</span></nav>`
    : "";
  return `
    <header class="top-nav">
      <div class="nav-start">
        <a class="wordmark" href="${HOME}">AX Design Studio</a>
        ${crumb}
      </div>
      <nav class="nav-menu" aria-label="Primary">
        ${navLink("Projects", HOME, view.name === "projects")}
        ${navLink("Presentation", hrefFor({ name: "presentation", project: null }), view.name === "presentation")}
        ${navLink("Motions", hrefFor({ name: "motions", kind: null, preset: null }), view.name === "motions")}
      </nav>
      <div class="nav-actions">
        <button type="button" class="button button--secondary" id="mode-toggle" aria-label="${nextModeLabel}" title="${nextModeLabel}">
          ${modeToggleIcon(mode)}
        </button>
        <div class="nav-settings">
          <button type="button" class="button button--secondary" id="nav-settings" aria-label="설정" aria-haspopup="menu" aria-expanded="false" aria-controls="nav-settings-menu">
            ${settingsIcon()}
          </button>
          <div class="nav-popover" id="nav-settings-menu" role="menu" hidden>
            <button type="button" class="nav-popover__item" id="nav-reset" role="menuitem">리셋</button>
          </div>
        </div>
      </div>
    </header>
    <main class="shell shell--${view.name === "presentation" ? "studio" : view.name}" id="main">${mainHtml}</main>
  `;
}

function renderMain(): string {
  if (loadState.status === "loading") {
    return `
      <section class="state-panel state-panel--canvas" aria-busy="true">
        <h1 class="state-panel__title">Loading presentation</h1>
        <p class="state-panel__text">Reading the conference data and the projects.</p>
      </section>
    `;
  }
  if (loadState.status === "error") {
    return `
      <section class="state-panel state-panel--soft" role="alert">
        <h1 class="state-panel__title">Presentation failed to load</h1>
        <p class="state-panel__text">${loadState.message}</p>
        <p class="state-panel__text">${loadState.hint}</p>
        <p class="state-panel__text"><button type="button" class="button" id="index-retry">다시 불러오기</button></p>
      </section>
    `;
  }
  if (view.name === "motions") return renderMotions({ kind: view.kind, presetId: view.preset, mode: readStoredMode(), conference: loadState.conference });
  const project = openProject();
  if (!project) return renderProjects(readStoredMode());
  const deck = projectDeck(project, readStoredMode());
  syncPresentationMode(deck, readStoredMode());
  return renderPresentation(deck, loadState.conference, deckProject(project));
}

function saveDeck(project: Project, deck: PresentationDeck): void {
  if (!saveProjectDeck(project, deck)) showToast("브라우저 저장 공간이 부족해 덱을 저장하지 못했습니다.");
}

/** On localhost, thumbnail.webp follows deck.json and the thumbnail page, so the deployed card needs no drawing. */
function refreshDiskThumbnail(project: Project, conference: ConferenceIndex): void {
  void refreshDiskThumb(project, conference).catch(() => undefined);
}

function deckProject(project: Project): DeckProject {
  return {
    id: project.meta.id,
    media: project.media,
    thumbnailPageId: project.meta.thumbnailPageId,
    onThumbnailPage: (pageId) => {
      void (async () => {
        if (!(await setThumbnailPage(project, pageId))) {
          showToast("썸네일 페이지를 저장하지 못했습니다.");
          return;
        }
        if (loadState.status === "ready") refreshDiskThumbnail(project, loadState.conference);
        render();
        showToast(pageId ? "프로젝트 썸네일로 지정했습니다." : "썸네일 지정을 해제했습니다. page 1이 썸네일입니다.");
      })();
    },
  };
}

/**
 * Puts the address on a screen that exists: #/projects, #/presentation/<id> of a known project, or
 * #/motions/<kind>/<presetId> of a known preset (the last one of the sub-tab when none is given, its first when unknown).
 */
function resolveRoute(route: Route = parseHash()): void {
  if (route.name === "projects") {
    view = { name: "projects" };
    return;
  }
  if (route.name === "motions") {
    const memory = readMotionsMemory();
    const kind = route.kind ?? memory.kind;
    const asked = findMotionPreset(route.preset ?? memory.last[kind] ?? "");
    const preset = asked?.kind === kind ? asked : motionPresetsOf(kind)[0]!;
    const href = hrefFor({ name: "motions", kind, preset: preset.id });
    if (window.location.hash !== href) history.replaceState(null, "", href);
    view = { name: "motions", kind, preset: preset.id };
    return;
  }
  if (route.name === "notfound") {
    history.replaceState(null, "", HOME);
    view = { name: "projects" };
    return;
  }
  // Until the list is read, keep the address; it is resolved again once the projects are in.
  if (loadState.status !== "ready") return;
  const id = route.project ?? lastOpened();
  if (!findProject(id) || !id) {
    if (route.project) showToast("프로젝트를 찾을 수 없습니다.");
    history.replaceState(null, "", HOME);
    view = { name: "projects" };
    return;
  }
  if (!route.project) history.replaceState(null, "", hrefFor({ name: "presentation", project: id }));
  view = { name: "presentation", project: id };
  setLastOpened(id);
}

function render(): void {
  releasePresentationMenu();
  releaseProjectsMenu();
  releaseMotions();
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("#app not found");
  applyMode(readStoredMode());
  app.innerHTML = shell(renderMain());

  app.querySelector("#index-retry")?.addEventListener("click", () => {
    void loadData();
  });

  app.querySelector("#mode-toggle")?.addEventListener("click", () => {
    const next = readStoredMode() === "dark" ? "light" : "dark";
    applyMode(next);
    const project = loadState.status === "ready" ? openProject() : undefined;
    if (project) {
      const deck = projectDeck(project, next);
      if (recolorBarePages(deck, next)) saveDeck(project, deck);
    }
    render();
  });
  bindSettingsMenu(app);

  if (loadState.status !== "ready") return;
  const conference = loadState.conference;
  if (view.name === "motions") {
    bindMotions(app, { kind: view.kind, presetId: view.preset, mode: readStoredMode(), conference }, render);
    return;
  }
  const project = openProject();
  if (!project) {
    bindProjects(app, { index: conference, tone: readStoredMode(), onChange: render });
    return;
  }
  const deck = projectDeck(project, readStoredMode());
  const setDefaults = async (pages: PresentationDeck["pages"]) => {
    const ok = projectsOnDisk() && (await writeProjectDefaults(project, pages));
    if (ok) {
      saveDeck(project, deck);
      refreshDiskThumbnail(project, conference);
    }
    return ok;
  };
  bindPresentation(app, deck, conference, deckProject(project), {
    onSetPageDefault: () => setDefaults(defaultsWithPage(deck, deck.selected, defaultPresentationDeck(project.defaults)?.pages ?? [])),
    onSetDeckDefault: () => setDefaults(deck.pages),
  }, () => {
    saveDeck(project, deck);
    render();
  });
}

function bindSettingsMenu(app: HTMLElement): void {
  const button = app.querySelector<HTMLButtonElement>("#nav-settings");
  const menu = app.querySelector<HTMLElement>("#nav-settings-menu");
  const wrap = app.querySelector<HTMLElement>(".nav-settings");
  if (!button || !menu || !wrap) return;
  const close = () => {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", onDoc);
    document.removeEventListener("keydown", onKey);
  };
  const onDoc = (event: MouseEvent) => {
    if (event.target instanceof Node && wrap.contains(event.target)) return;
    close();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = menu.hidden;
    if (!open) {
      close();
      return;
    }
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
  });
  app.querySelector("#nav-reset")?.addEventListener("click", () => {
    close();
    void (async () => {
      const ok = await confirmProceed("세팅한 초기화 기준을 지우고 진행하시겠습니까?");
      if (!ok) return;
      resetDecks();
      render();
      showToast("리셋하였습니다.");
    })();
  });
}

async function readConference(): Promise<ConferenceIndex | null> {
  try {
    const response = await fetch(`${CONFERENCE_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return null;
    const text = await response.text();
    // Vite answers a missing file with index.html.
    if (text.trimStart().startsWith("<")) return null;
    const conference = JSON.parse(text) as ConferenceIndex;
    return conference?.version === 1 && Array.isArray(conference.backgrounds) ? conference : null;
  } catch {
    return null;
  }
}

async function readGraphicLibrary(): Promise<void> {
  try {
    const response = await fetch(`${INDEX_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return;
    const text = await response.text();
    if (text.trimStart().startsWith("<")) return;
    const index = JSON.parse(text) as SiteIndex;
    if (!Array.isArray(index?.captures)) return;
    const remote = (path: string | null) => (path ? LIBRARY_ORIGIN + path : null);
    syncGraphicLibrary(
      index.captures.map((capture) => ({
        ...capture,
        asset: { ...capture.asset, path: LIBRARY_ORIGIN + capture.asset.path, thumbPath: remote(capture.asset.thumbPath) },
      })),
    );
  } catch {
    // No library: the ASSETS tab stays hidden.
  }
}

async function loadData(): Promise<void> {
  loadState = { status: "loading" };
  render();
  const extras = Promise.all([loadUploads(), readGraphicLibrary(), loadMotionFiles(), loadMotionDefaults()]);
  const listed = loadProjects(BUILT_PROJECTS);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const conference = await readConference();
    if (conference) {
      await extras;
      if (!(await listed)) {
        loadState = { status: "error", message: "The project list could not be read.", hint: "Check that the dev server (npm run dev) is running." };
        render();
        return;
      }
      loadState = { status: "ready", conference };
      resolveRoute();
      render();
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 400));
  }
  await extras;
  loadState = { status: "error", message: `${CONFERENCE_URL} could not be read.`, hint: "Check that <code>public/data/conference.json</code> exists." };
  render();
}

// The first screen is Projects. An unknown address goes there too.
onRouteChange((route) => {
  resolveRoute(route);
  render();
});

void loadData();
