/**
 * The project list and each project's working deck.
 * Localhost: presentation/<dir>/ through the dev server (/__projects); new, copied, renamed, and deleted projects are written to disk.
 * Deployed site: the projects built into the site, plus the ones made in this browser, minus the ones deleted in this browser.
 * Changes there stay in this browser (ax-projects, ax-project-deck:<id>).
 */
import type { BuiltProject } from "./built-projects.ts";
import { presentationProjectEnabled } from "./shared/presentation-files.ts";
import {
  clearPresentationDeck,
  deckDefaults,
  loadPresentationDeck,
  migrateLegacyDeck,
  savePresentationDeck,
  storedDeck,
  type DeckDefaults,
  type PresentationDeck,
  type PresentationPage,
  type PresentationTone,
} from "./shared/presentation.ts";
import {
  cleanTitle,
  copyTitle,
  isProjectId,
  NEW_PROJECT_TITLE,
  newProjectId,
  newProjectPages,
  parseProjectMeta,
  PROJECT_THUMB_FILE,
  PROJECTS_ROUTE,
  uniqueTitle,
  type ListedProject,
  type ProjectMeta,
  type ProjectSort,
  type ProjectView,
} from "./shared/projects.ts";

export const PROJECTS_KEY = "ax-projects";
export const PROJECTS_VIEW_KEY = "ax-projects-view";

/** disk: a folder on localhost. build: built into the deployed site. browser: made in this browser only. */
export type ProjectOrigin = "disk" | "build" | "browser";

export type Project = {
  meta: ProjectMeta;
  origin: ProjectOrigin;
  /** Project whose page folders hold the deck's pres: files. A copy made in this browser reads its source's files. */
  media: string;
  /** deck.json. Null for a project made in this browser: its working deck is all there is. */
  defaults: DeckDefaults | null;
  /** thumbnail.webp, when there is one that is up to date with deck.json and project.json. */
  thumbnail: string | null;
  /** Page thumbnail.webp is drawn from: the thumbnail page in project.json on disk or in the build. A deployed site's own choice can differ. */
  thumbnailSource: string | null;
};

type MetaEdit = { title?: string; thumbnailPageId?: string | null; updatedAt?: string };
type BrowserProject = ProjectMeta & { media: string };
/** What ax-projects holds. */
type BrowserRecord = {
  created: BrowserProject[];
  edits: Record<string, MetaEdit>;
  deleted: string[];
  lastOpened: string | null;
};

let projects: Project[] = [];
const decks = new Map<string, PresentationDeck>();
/** Stored pages of each deck as last loaded or saved, so only a real change counts as an edit. */
const savedPages = new Map<string, string>();

export function projectsOnDisk(): boolean {
  return presentationProjectEnabled();
}

function readRecord(): BrowserRecord {
  const empty: BrowserRecord = { created: [], edits: {}, deleted: [], lastOpened: null };
  try {
    const raw = JSON.parse(localStorage.getItem(PROJECTS_KEY) ?? "null") as Partial<BrowserRecord> | null;
    if (!raw || typeof raw !== "object") return empty;
    const created = (Array.isArray(raw.created) ? raw.created : []).flatMap((item) => {
      const meta = parseProjectMeta(item, "");
      const media = (item as { media?: unknown } | null)?.media;
      return meta ? [{ ...meta, media: isProjectId(media) ? media : meta.id }] : [];
    });
    const edits = raw.edits && typeof raw.edits === "object" ? raw.edits : {};
    const deleted = Array.isArray(raw.deleted) ? raw.deleted.filter(isProjectId) : [];
    return { created, edits, deleted, lastOpened: isProjectId(raw.lastOpened) ? raw.lastOpened : null };
  } catch {
    return empty;
  }
}

function writeRecord(record: BrowserRecord): boolean {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

function editRecord(change: (record: BrowserRecord) => void): boolean {
  const record = readRecord();
  change(record);
  return writeRecord(record);
}

function later(a: string, b: string | undefined): string {
  return b && Date.parse(b) > Date.parse(a) ? b : a;
}

function defaultsOf(deck: unknown): DeckDefaults | null {
  const pages = (deck as { pages?: unknown } | null)?.pages;
  return Array.isArray(pages) && pages.length > 0 ? deckDefaults(pages) : null;
}

function thumbUrl(id: string, version: number): string {
  return `${PROJECTS_ROUTE}/${encodeURIComponent(id)}/${PROJECT_THUMB_FILE}?v=${version}`;
}

function fromListed(item: ListedProject): Project | null {
  const meta = parseProjectMeta(item, item.dir);
  if (!meta) return null;
  return {
    meta,
    origin: "disk",
    media: meta.id,
    defaults: defaultsOf(item.deck),
    thumbnail: item.thumbnail == null ? null : thumbUrl(meta.id, item.thumbnail),
    thumbnailSource: meta.thumbnailPageId,
  };
}

function withEdits(project: Project, edit: MetaEdit | undefined): Project {
  if (!edit) return project;
  const meta = { ...project.meta, updatedAt: later(project.meta.updatedAt, edit.updatedAt) };
  // Title and thumbnail page live on disk for a localhost project; a deployed site keeps its own.
  if (project.origin === "build") {
    const title = cleanTitle(edit.title);
    if (title) meta.title = title;
    if (edit.thumbnailPageId !== undefined) meta.thumbnailPageId = edit.thumbnailPageId;
  }
  return { ...project, meta };
}

/** Reads the list. Localhost asks the dev server; elsewhere the build and this browser's record make it. False when the list could not be read. */
export async function loadProjects(built: readonly BuiltProject[]): Promise<boolean> {
  migrateLegacyDeck();
  decks.clear();
  savedPages.clear();
  const record = readRecord();
  if (projectsOnDisk()) {
    try {
      const response = await fetch(PROJECTS_ROUTE, { cache: "no-store" });
      if (!response.ok) return false;
      const body = (await response.json()) as { projects?: ListedProject[] };
      projects = (body.projects ?? []).flatMap((item) => fromListed(item) ?? []).map((project) => withEdits(project, record.edits[project.meta.id]));
      return true;
    } catch {
      return false;
    }
  }
  const hidden = new Set(record.deleted);
  const fromBuild = built.flatMap((item): Project[] => {
    const meta = parseProjectMeta(item.meta, item.dir);
    if (!meta || hidden.has(meta.id)) return [];
    const project: Project = { meta, origin: "build", media: meta.id, defaults: defaultsOf(item.deck), thumbnail: item.thumbnail, thumbnailSource: meta.thumbnailPageId };
    return [withEdits(project, record.edits[meta.id])];
  });
  const taken = new Set(fromBuild.map((project) => project.meta.id));
  const fromBrowser = record.created.flatMap(({ media, ...meta }): Project[] =>
    taken.has(meta.id) ? [] : [{ meta, origin: "browser", media, defaults: null, thumbnail: null, thumbnailSource: null }],
  );
  projects = [...fromBuild, ...fromBrowser];
  return true;
}

export function listProjects(): readonly Project[] {
  return projects;
}

export function findProject(id: string | null): Project | undefined {
  return id ? projects.find((project) => project.meta.id === id) : undefined;
}

function pagesKey(deck: PresentationDeck): string {
  return JSON.stringify(storedDeck(deck.pages).pages);
}

/** The deck the user sees: this browser's working copy, else deck.json, else a new project's five pages. */
export function projectDeck(project: Project, tone: PresentationTone): PresentationDeck {
  const id = project.meta.id;
  let deck = decks.get(id);
  if (!deck) {
    deck = loadPresentationDeck(id, project.defaults, () => ({ selected: 0, pages: newProjectPages(tone) }));
    decks.set(id, deck);
    savedPages.set(id, pagesKey(deck));
  }
  return deck;
}

/** Saves the working deck in this browser. A change to its pages also counts as an edit. False when storage is full. */
export function saveProjectDeck(project: Project, deck: PresentationDeck): boolean {
  const id = project.meta.id;
  try {
    savePresentationDeck(id, deck, project.defaults);
  } catch {
    return false;
  }
  const key = pagesKey(deck);
  if (savedPages.get(id) !== key) {
    savedPages.set(id, key);
    const now = new Date().toISOString();
    project.meta.updatedAt = now;
    editRecord((record) => {
      const created = record.created.find((item) => item.id === id);
      if (created) created.updatedAt = now;
      else record.edits[id] = { ...record.edits[id], updatedAt: now };
    });
  }
  return true;
}

export function lastOpened(): string | null {
  const id = readRecord().lastOpened;
  return findProject(id) ? id : null;
}

export function setLastOpened(id: string | null): void {
  if (readRecord().lastOpened === id) return;
  editRecord((record) => {
    record.lastOpened = id;
  });
}

async function post(body: unknown): Promise<ListedProject | null | undefined> {
  try {
    const response = await fetch(PROJECTS_ROUTE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) return undefined;
    return ((await response.json()) as { project?: ListedProject | null }).project ?? null;
  } catch {
    return undefined;
  }
}

function titles(): string[] {
  return projects.map((project) => project.meta.title);
}

/** Adds a browser-only project with these pages. */
function addBrowserProject(title: string, pages: PresentationPage[], media: string | null, thumbnailPageId: string | null): Project | null {
  const now = new Date().toISOString();
  const id = newProjectId();
  const meta: ProjectMeta = { id, dir: "", title, thumbnailPageId, createdAt: now, updatedAt: now };
  const project: Project = { meta, origin: "browser", media: media ?? id, defaults: null, thumbnail: null, thumbnailSource: null };
  const deck: PresentationDeck = { selected: 0, pages };
  try {
    savePresentationDeck(id, deck, null);
  } catch {
    return null;
  }
  if (!editRecord((record) => record.created.push({ ...meta, media: project.media }))) {
    clearPresentationDeck(id);
    return null;
  }
  decks.set(id, deck);
  savedPages.set(id, pagesKey(deck));
  projects = [...projects, project];
  return project;
}

function addListed(item: ListedProject | null | undefined): Project | null {
  const project = item ? fromListed(item) : null;
  if (!project) return null;
  projects = [...projects, project];
  return project;
}

/** A new project: page 1 type 1, pages 2 to 5 empty, titled 새 프로젝트 (or 새 프로젝트 2, …). */
export async function createProject(tone: PresentationTone): Promise<Project | null> {
  const title = uniqueTitle(NEW_PROJECT_TITLE, titles());
  const pages = newProjectPages(tone);
  if (!projectsOnDisk()) return addBrowserProject(title, pages, null, null);
  return addListed(await post({ action: "create", title, deck: storedDeck(pages) }));
}

/** A copy of what the user sees in `source`, titled `<title> 복사본`. Localhost also copies its page folders. */
export async function duplicateProject(source: Project, tone: PresentationTone): Promise<Project | null> {
  const deck = projectDeck(source, tone);
  const title = copyTitle(source.meta.title, titles());
  if (!projectsOnDisk()) return addBrowserProject(title, structuredClone(deck.pages).map((page) => ({ ...page, thumb: "" })), source.media, source.meta.thumbnailPageId);
  return addListed(await post({ action: "duplicate", source: source.meta.id, title, deck: storedDeck(deck.pages) }));
}

function applyListed(project: Project, item: ListedProject | null | undefined): void {
  const next = item ? fromListed(item) : null;
  if (!next) return;
  project.meta = { ...next.meta, updatedAt: later(next.meta.updatedAt, project.meta.updatedAt) };
  project.thumbnail = next.thumbnail;
  project.thumbnailSource = next.thumbnailSource;
}

/** Only the title changes; the folder name and id stay. False when the title is empty or could not be saved. */
export async function renameProject(project: Project, raw: string): Promise<boolean> {
  const title = cleanTitle(raw);
  if (!title) return false;
  if (title === project.meta.title) return true;
  const id = project.meta.id;
  if (project.origin === "disk") {
    const item = await post({ action: "rename", id, title });
    if (item === undefined) return false;
    applyListed(project, item);
    return true;
  }
  const saved = editRecord((record) => {
    const created = record.created.find((item) => item.id === id);
    if (created) created.title = title;
    else record.edits[id] = { ...record.edits[id], title };
  });
  if (saved) project.meta.title = title;
  return saved;
}

/** The page on the card. Null goes back to page 1. */
export async function setThumbnailPage(project: Project, pageId: string | null): Promise<boolean> {
  const id = project.meta.id;
  if (project.origin === "disk") {
    const item = await post({ action: "thumbnail-page", id, pageId });
    if (item === undefined) return false;
    applyListed(project, item);
    return true;
  }
  const saved = editRecord((record) => {
    const created = record.created.find((item) => item.id === id);
    if (created) created.thumbnailPageId = pageId;
    else record.edits[id] = { ...record.edits[id], thumbnailPageId: pageId };
  });
  if (saved) project.meta.thumbnailPageId = pageId;
  return saved;
}

/** Localhost deletes presentation/<dir>/. A deployed site drops a browser project and hides a built one in this browser. */
export async function deleteProject(project: Project): Promise<boolean> {
  const id = project.meta.id;
  if (project.origin === "disk") {
    if ((await post({ action: "delete", id })) === undefined) return false;
  } else {
    const saved = editRecord((record) => {
      record.created = record.created.filter((item) => item.id !== id);
      if (project.origin === "build" && !record.deleted.includes(id)) record.deleted.push(id);
    });
    if (!saved) return false;
  }
  editRecord((record) => {
    delete record.edits[id];
    if (record.lastOpened === id) record.lastOpened = null;
  });
  try {
    clearPresentationDeck(id);
  } catch {
    /* Storage is off: nothing was saved. */
  }
  decks.delete(id);
  savedPages.delete(id);
  projects = projects.filter((item) => item !== project);
  return true;
}

/** 기본값 세팅: writes the pages to the project's deck.json. Localhost only. */
export async function writeProjectDefaults(project: Project, pages: PresentationPage[]): Promise<boolean> {
  if (project.origin !== "disk") return false;
  const deck = storedDeck(pages);
  const item = await post({ action: "deck", id: project.meta.id, deck });
  if (item === undefined) return false;
  project.defaults = deckDefaults(JSON.parse(JSON.stringify(deck.pages)) as unknown[]);
  applyListed(project, item);
  return true;
}

/** Writes thumbnail.webp (a WebP data URL). Localhost only. */
export async function writeProjectThumbnail(project: Project, image: string): Promise<boolean> {
  if (project.origin !== "disk") return false;
  const item = await post({ action: "thumbnail", id: project.meta.id, image });
  if (item === undefined) return false;
  applyListed(project, item);
  return true;
}

/** 리셋: drops this browser's working decks, so each built project opens its deck.json again. A project made in this browser keeps its deck. */
export function resetDecks(): void {
  for (const project of projects) {
    if (project.origin === "browser") continue;
    try {
      clearPresentationDeck(project.meta.id);
    } catch {
      /* Storage is off: nothing was saved. */
    }
    decks.delete(project.meta.id);
    savedPages.delete(project.meta.id);
  }
}

export function readProjectsView(): { sort: ProjectSort; view: ProjectView } {
  try {
    const raw = JSON.parse(localStorage.getItem(PROJECTS_VIEW_KEY) ?? "null") as { sort?: unknown; view?: unknown } | null;
    const sort = raw?.sort === "title" || raw?.sort === "created" ? raw.sort : "updated";
    return { sort, view: raw?.view === "list" ? "list" : "grid" };
  } catch {
    return { sort: "updated", view: "grid" };
  }
}

export function writeProjectsView(value: { sort: ProjectSort; view: ProjectView }): void {
  try {
    localStorage.setItem(PROJECTS_VIEW_KEY, JSON.stringify(value));
  } catch {
    /* The choice still applies until the next reload. */
  }
}
