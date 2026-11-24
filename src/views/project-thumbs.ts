/**
 * Project card thumbnails: the project's thumbnail page drawn by the Presentation renderer, 960 × 540 WebP.
 * A page drawn once is kept in IndexedDB (ax-project-thumbs) with a hash of its state, so an unchanged page is not drawn again.
 * thumbnail.webp (localhost writes it, a build ships it) shows deck.json's thumbnail page and is used while that is the page on the card.
 */
import type { ConferenceIndex } from "../shared/conference.ts";
import { defaultPresentationDeck, stampOf, type PresentationDeck, type PresentationPage } from "../shared/presentation.ts";
import { thumbnailPage } from "../shared/projects.ts";
import { isVideoSrc } from "../shared/studio.ts";
import { writeProjectThumbnail, type Project } from "../projects-store.ts";
import { presentationStudioConfig } from "./presentation.ts";
import { renderStudioStill, studioImagesReady } from "./studio.ts";

const DB_NAME = "ax-project-thumbs";
const STORE = "thumbs";
type Entry = { id: string; hash: string; url: string };

/** `complete`: every picture on the page had loaded when it was drawn. */
const memory = new Map<string, { hash: string; url: string; complete: boolean }>();
const builtPages = new Map<string, { key: string; hash: string | null }>();
/** Projects whose thumbnail.webp is being written. */
const writing = new Set<string>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexedDB open failed"));
  });
}

function run(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<unknown> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const request = action(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => {
          db.close();
          resolve(request.result);
        };
        request.onerror = () => {
          db.close();
          reject(request.error ?? new Error("indexedDB request failed"));
        };
      }),
  );
}

/** Same page, same files, same picture. */
export function thumbHash(page: PresentationPage, media: string): string {
  return stampOf(`${media}\n${JSON.stringify(page.state)}`);
}

/** The page the card shows now: the working deck's thumbnail page. */
export function cardPage(project: Project, deck: PresentationDeck): PresentationPage | null {
  return thumbnailPage(deck.pages, project.meta.thumbnailPageId);
}

/** The page thumbnail.webp is drawn from: deck.json's thumbnail page as project.json on disk or in the build names it. */
function builtPage(project: Project): PresentationPage | null {
  const pages = defaultPresentationDeck(project.defaults)?.pages ?? [];
  return thumbnailPage(pages, project.thumbnailSource);
}

function builtHash(project: Project): string | null {
  if (!project.defaults) return null;
  const key = `${project.defaults.stamp}:${project.thumbnailSource ?? ""}`;
  const known = builtPages.get(project.meta.id);
  if (known?.key === key) return known.hash;
  const page = builtPage(project);
  const hash = page ? thumbHash(page, project.media) : null;
  builtPages.set(project.meta.id, { key, hash });
  return hash;
}

async function draw(page: PresentationPage, project: Project, index: ConferenceIndex): Promise<{ url: string; complete: boolean } | null> {
  const config = presentationStudioConfig(index, `project-thumb:${project.meta.id}`, "", project.media);
  const url = await renderStudioStill(page.state, config, "image/webp").catch(() => null);
  // A picture that did not load would stay missing; the caller draws it again next time instead of keeping it. A still has no video frames to wait for.
  const pictures = { ...page.state, layers: page.state.layers.filter((layer) => !(layer.kind === "image" && isVideoSrc(layer.src))) };
  return url ? { url, complete: studioImagesReady(pictures, config) } : null;
}

/**
 * Localhost: writes thumbnail.webp from deck.json's thumbnail page when the file is missing or older than deck.json and project.json.
 * `drawn` is the card's picture when the card already shows that page.
 */
export async function refreshDiskThumb(project: Project, index: ConferenceIndex, drawn?: { url: string; complete: boolean }): Promise<void> {
  const id = project.meta.id;
  if (project.origin !== "disk" || project.thumbnail || writing.has(id)) return;
  const page = builtPage(project);
  if (!page) return;
  writing.add(id);
  try {
    const image = drawn ?? (await draw(page, project, index));
    if (image?.complete && image.url.startsWith("data:image/webp")) await writeProjectThumbnail(project, image.url);
  } finally {
    writing.delete(id);
  }
}

/** A thumbnail already at hand, without drawing or waiting. */
export function knownThumb(project: Project, deck: PresentationDeck): string | null {
  const page = cardPage(project, deck);
  if (!page) return null;
  const hash = thumbHash(page, project.media);
  const hit = memory.get(project.meta.id);
  if (hit?.hash === hash) return hit.url;
  if (project.thumbnail && builtHash(project) === hash) return project.thumbnail;
  return null;
}

async function cached(id: string, hash: string): Promise<string | null> {
  try {
    const entry = (await run("readonly", (store) => store.get(id))) as Entry | undefined;
    return entry?.hash === hash ? entry.url : null;
  } catch {
    return null;
  }
}

async function store(id: string, hash: string, url: string): Promise<void> {
  try {
    await run("readwrite", (store) => store.put({ id, hash, url } satisfies Entry));
  } catch {
    /* The thumbnail is drawn again next time. */
  }
}

export async function dropProjectThumb(id: string): Promise<void> {
  memory.delete(id);
  builtPages.delete(id);
  try {
    await run("readwrite", (store) => store.delete(id));
  } catch {
    /* Nothing was kept. */
  }
}

/**
 * The card's thumbnail URL: kept, shipped, or drawn now.
 * On localhost, when the card shows deck.json's thumbnail page and thumbnail.webp is missing or older than the deck, it is written too.
 */
export async function projectThumb(project: Project, deck: PresentationDeck, index: ConferenceIndex): Promise<string | null> {
  const page = cardPage(project, deck);
  if (!page) return null;
  const id = project.meta.id;
  const hash = thumbHash(page, project.media);
  // The card shows deck.json's thumbnail page, which thumbnail.webp is drawn from while it is up to date.
  const onBuiltPage = builtHash(project) === hash;
  if (project.thumbnail && onBuiltPage) return project.thumbnail;
  const hit = memory.get(id);
  let url = hit?.hash === hash ? hit.url : await cached(id, hash);
  let complete = hit?.hash === hash ? hit.complete : Boolean(url);
  if (!url) {
    const image = await draw(page, project, index);
    if (!image) return null;
    ({ url, complete } = image);
    if (complete) void store(id, hash, url);
  }
  memory.set(id, { hash, url, complete });
  void refreshDiskThumb(project, index, onBuiltPage ? { url, complete } : undefined);
  return url;
}
