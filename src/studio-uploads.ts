/**
 * Images added in this browser before page folders existed (IndexedDB ax-studio-uploads). Layers point at them as upload:<id>.
 * New files go to the page folder; these are only read so older pages still show them.
 */
import { UPLOAD_PREFIX } from "./shared/studio.ts";

export type StudioUpload = { id: string; name: string; createdAt: string; url: string };
type StoredUpload = { id: string; name: string; createdAt: string; blob: Blob };

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
  return { id: stored.id, name: stored.name, createdAt: stored.createdAt, url: URL.createObjectURL(stored.blob) };
}

export async function loadUploads(): Promise<void> {
  try {
    const stored = ((await run("readonly", (store) => store.getAll())) as StoredUpload[] | undefined) ?? [];
    for (const upload of uploads) URL.revokeObjectURL(upload.url);
    uploads = stored.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)).map(toUpload);
  } catch {
    uploads = [];
  }
}
