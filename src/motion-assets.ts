/**
 * Pictures for the image motions: what a slot ref points at, where pictures can be picked from (a project's deck,
 * Conference, the graphic library, or a file of mine), and loading them so canvases stay exportable.
 * Refs: "pres:<projectId>/<pageId>/<name>", "conf:<id>", "bg:<id>", "lib:<slug>", "file:<id>".
 */
import { assetUrl } from "./lib/dom.ts";
import type { ConferenceIndex } from "./shared/conference.ts";
import { MOTION_SLOTS, motionDefaults } from "./shared/motions.ts";
import { parsePresentationFile, presentationFileUrl } from "./shared/presentation-files.ts";
import { isVideoSrc } from "./shared/studio.ts";
import { findProject, projectDeck, type Project } from "./projects-store.ts";
import { readMotionsMemory } from "./motions-store.ts";
import { graphicLibraryItems } from "./views/studio.ts";

export type MotionAsset = { ref: string; url: string; thumb: string; label: string };

const DB_NAME = "ax-motion-files";
const STORE = "files";
type StoredFile = { id: string; name: string; createdAt: string; blob: Blob };
const files = new Map<string, { name: string; url: string; blob: Blob }>();
const images = new Map<string, Promise<HTMLImageElement | null>>();
/** The first read also deletes stored files no slot points at (for example after the slots went back to the examples). */
let pruned = false;
/** The slots' examples: graphic-library pictures with different colors and shapes. */
const EXAMPLE_SLUGS = [
  "screenprint-flower-bloom",
  "chromatic-glass-ribbons",
  "red-blue-arch",
  "indigo-rainbow-arches",
  "citrus-arc-blocks",
  "coral-blue-luminous-ring",
  "floral-radial-bloom",
  "blue-paper-planes",
];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
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

/** Reads the files of mine kept in this browser. The app's first read (before Motions can be used) forgets unused ones. */
export async function loadMotionFiles(): Promise<void> {
  try {
    const stored = ((await run("readonly", (store) => store.getAll())) as StoredFile[] | undefined) ?? [];
    const prune = !pruned;
    pruned = true;
    const used = new Set(readMotionsMemory().slots ?? []);
    for (const file of stored) {
      if (prune && !used.has(`file:${file.id}`)) {
        void run("readwrite", (store) => store.delete(file.id)).catch(() => undefined);
        continue;
      }
      if (!files.has(file.id)) files.set(file.id, { name: file.name, url: URL.createObjectURL(file.blob), blob: file.blob });
    }
  } catch {
    /* No stored files: the slots show what is left. */
  }
}

/** Keeps a picked file in this browser and returns its slot ref. */
export async function addMotionFile(file: File): Promise<string | null> {
  const stored: StoredFile = { id: `file-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, name: file.name, createdAt: new Date().toISOString(), blob: file };
  try {
    await run("readwrite", (store) => store.put(stored));
  } catch {
    return null;
  }
  files.set(stored.id, { name: file.name, url: URL.createObjectURL(file), blob: file });
  return `file:${stored.id}`;
}

/** Forgets a file of mine once no slot points at it. */
export async function releaseMotionFile(ref: string | null, slots: readonly (string | null)[]): Promise<void> {
  if (!ref?.startsWith("file:") || slots.includes(ref)) return;
  const id = ref.slice("file:".length);
  const file = files.get(id);
  if (file) URL.revokeObjectURL(file.url);
  files.delete(id);
  try {
    await run("readwrite", (store) => store.delete(id));
  } catch {
    /* It stays stored; nothing points at it. */
  }
}

/** The pictures a project's deck uses: image layers and image backgrounds from its page folders. */
export function projectAssets(project: Project, mode: "light" | "dark"): MotionAsset[] {
  const seen = new Set<string>();
  const assets: MotionAsset[] = [];
  for (const page of projectDeck(project, mode).pages) {
    const srcs = page.state.layers.flatMap((layer) => (layer.kind === "image" ? [layer.src] : []));
    if (page.state.background?.file && page.state.background.mode !== "video") srcs.push(page.state.background.file);
    for (const src of srcs) {
      const file = parsePresentationFile(src);
      if (!file || isVideoSrc(src) || seen.has(src)) continue;
      seen.add(src);
      const url = presentationFileUrl(src, project.media);
      if (url) assets.push({ ref: `pres:${project.meta.id}/${file.pageId}/${file.name}`, url, thumb: url, label: file.name });
    }
  }
  return assets;
}

export function conferenceAssets(conference: ConferenceIndex): MotionAsset[] {
  const sources = [...conference.speakers, ...conference.logos].map((item) => ({ ref: `conf:${item.id}`, url: assetUrl(item.path), thumb: assetUrl(item.thumbPath), label: item.label }));
  const slide = conference.backgrounds.find((item) => item.id === "slide");
  if (slide?.image) sources.push({ ref: "bg:slide", url: assetUrl(slide.image.path), thumb: assetUrl(slide.thumbPath ?? slide.image.path), label: "Slide 배경" });
  return sources;
}

export function libraryAssets(): MotionAsset[] {
  return graphicLibraryItems().map((item) => ({ ref: `lib:${item.src}`, url: item.url, thumb: item.thumb, label: item.label }));
}

export function resolveMotionRef(ref: string | null, conference: ConferenceIndex): MotionAsset | null {
  if (!ref) return null;
  if (ref.startsWith("pres:")) {
    const rest = ref.slice("pres:".length);
    const slash = rest.indexOf("/");
    const project = slash > 0 ? findProject(rest.slice(0, slash)) : undefined;
    const src = `pres:${rest.slice(slash + 1)}`;
    const url = project ? presentationFileUrl(src, project.media) : null;
    return url ? { ref, url, thumb: url, label: parsePresentationFile(src)?.name ?? ref } : null;
  }
  if (ref.startsWith("file:")) {
    const file = files.get(ref.slice("file:".length));
    return file ? { ref, url: file.url, thumb: file.url, label: file.name } : null;
  }
  if (ref.startsWith("lib:")) return libraryAssets().find((item) => item.ref === ref) ?? null;
  return conferenceAssets(conference).find((item) => item.ref === ref) ?? null;
}

/**
 * The slots' defaults: the ones saved with 이 값을 기본값으로 설정, or eight graphic-library examples (the library's own order
 * fills in for any example it no longer has; empty without the library).
 */
export function defaultMotionSlots(): (string | null)[] {
  const saved = motionDefaults().slots;
  if (saved) return [...saved];
  const library = libraryAssets().map((item) => item.ref);
  const examples = EXAMPLE_SLUGS.map((slug) => `lib:${slug}`).filter((ref) => library.includes(ref));
  const refs = [...new Set([...examples, ...library])].slice(0, MOTION_SLOTS);
  return Array.from({ length: MOTION_SLOTS }, (_, at) => refs[at] ?? null);
}

/** Loads a picture so a canvas that draws it can still be exported (CORS for the graphic library). Null when it fails. */
export function loadMotionImage(url: string): Promise<HTMLImageElement | null> {
  let pending = images.get(url);
  if (!pending) {
    pending = new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = url;
    });
    images.set(url, pending);
  }
  return pending;
}

/** A stand-in picture for a slot that is empty or failed to load. */
export function placeholderImage(index: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const hues = ["#4065F8", "#16427C", "#9747FF", "#001C33", "#A8BFC1", "#D8F1FF", "#FF105C", "#E8EEF8"];
  const gradient = ctx.createLinearGradient(0, 0, 600, 800);
  gradient.addColorStop(0, hues[index % hues.length]);
  gradient.addColorStop(1, hues[(index + 3) % hues.length]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 600, 800);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 160px Montserrat, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(index + 1), 300, 400);
  return canvas;
}

/** The pictures of the filled slots, in order. A picture that fails to load is a numbered stand-in. */
export async function motionSlotImages(slots: readonly (string | null)[], conference: ConferenceIndex): Promise<CanvasImageSource[]> {
  const filled = slots.map((ref, at) => ({ ref, at })).filter((slot) => slot.ref);
  return Promise.all(
    filled.map(async ({ ref, at }) => {
      const asset = resolveMotionRef(ref, conference);
      const image = asset ? await loadMotionImage(asset.url) : null;
      return image ?? placeholderImage(at);
    }),
  );
}

/** Where code copy points at a slot's picture: its full address, or the file of mine as a data URL. */
export async function motionCodeUrl(ref: string | null, conference: ConferenceIndex): Promise<string | null> {
  const asset = resolveMotionRef(ref, conference);
  if (!asset) return null;
  if (ref?.startsWith("file:")) {
    const file = files.get(ref.slice("file:".length));
    if (!file) return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file.blob);
    });
  }
  return new URL(asset.url, window.location.href).href;
}
