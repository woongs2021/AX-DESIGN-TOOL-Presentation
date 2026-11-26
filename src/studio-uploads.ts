/**
 * Images added in this browser before page folders existed (IndexedDB ax-studio-uploads). Layers point at them as upload:<id>.
 * New files go to the page folder; these are only read so older pages still show them. The one exception is a video
 * pasted from Motions on the deployed site, which has no page folders: it is kept here with its poster, as
 * upload:motion-….<ext> so it is still known as a video.
 */
import { UPLOAD_PREFIX } from "./shared/studio.ts";

export type StudioUpload = { id: string; name: string; createdAt: string; url: string; poster?: string };
type StoredUpload = { id: string; name: string; createdAt: string; blob: Blob; poster?: Blob };

const DB_NAME = "ax-studio-uploads";
const STORE = "images";

let uploads: StudioUpload[] = [];

function uploadSrc(upload: StudioUpload): string {
  return `${UPLOAD_PREFIX}${upload.id}`;
}

export function uploadBySrc(src: string): StudioUpload | undefined {
  return uploads.find((upload) => uploadSrc(upload) === src);
}

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

function toUpload(stored: StoredUpload): StudioUpload {
  const upload: StudioUpload = { id: stored.id, name: stored.name, createdAt: stored.createdAt, url: URL.createObjectURL(stored.blob) };
  if (stored.poster) upload.poster = URL.createObjectURL(stored.poster);
  return upload;
}

export async function loadUploads(): Promise<void> {
  try {
    const stored = ((await run("readonly", (store) => store.getAll())) as StoredUpload[] | undefined) ?? [];
    for (const upload of uploads) {
      URL.revokeObjectURL(upload.url);
      if (upload.poster) URL.revokeObjectURL(upload.poster);
    }
    uploads = stored.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)).map(toUpload);
  } catch {
    uploads = [];
  }
}

/** Keeps a video pasted from Motions in this browser and returns its layer source. Null when it cannot be stored. */
export async function addMotionUpload(blob: Blob, name: string, poster: Blob): Promise<string | null> {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  const stored: StoredUpload = {
    id: `motion-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
    name,
    createdAt: new Date().toISOString(),
    blob,
    poster,
  };
  try {
    await run("readwrite", (store) => store.put(stored));
  } catch {
    return null;
  }
  const upload = toUpload(stored);
  uploads.push(upload);
  return uploadSrc(upload);
}

/** The poster of a stored motion video, found by the video's URL. */
export function uploadPosterUrl(url: string): string | null {
  return uploads.find((upload) => upload.url === url)?.poster ?? null;
}
