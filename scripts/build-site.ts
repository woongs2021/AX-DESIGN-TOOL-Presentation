/**
 * Builds the Presentation as a static site in dist/app: the app with public/ (data and assets) and every
 * project's project.json, deck.json, and thumbnail.webp (bundled by src/built-projects.ts),
 * then the page-folder files each project's deck uses, where presentationFileUrl looks off localhost.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { GITHUB_PAGES_MAX_BYTES } from "../src/shared/limits.ts";
import { posterNameFor, posterUrlFor } from "../src/shared/motions.ts";
import { PRESENTATION_STATIC_DIR, parsePresentationFile } from "../src/shared/presentation-files.ts";
import { PROJECT_DECK_FILE, PROJECT_PAGES_DIR } from "../src/shared/projects.ts";
import { projectDirs } from "./presentation-project.ts";

const APP_DIR = "dist/app";

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/** Copies the page-folder files a project's deck.json uses next to the app, with a pasted motion's poster. Returns their bytes. */
function copyProjectMedia(appDir: string, projectId: string, projectDir: string): number {
  const root = join(projectDir, PROJECT_PAGES_DIR);
  const folders = new Map<string, string>();
  for (const name of existsSync(root) ? readdirSync(root) : []) {
    const meta = join(root, name, "page.json");
    if (!existsSync(meta)) continue;
    const id = (JSON.parse(readFileSync(meta, "utf8")) as { id?: unknown }).id;
    if (typeof id === "string") folders.set(id, join(root, name));
  }
  const deck = JSON.parse(readFileSync(join(projectDir, PROJECT_DECK_FILE), "utf8")) as {
    pages?: { state?: { layers?: { src?: unknown }[]; background?: { file?: unknown } } }[];
  };
  const srcs = new Set<string>();
  for (const page of deck.pages ?? []) {
    for (const layer of page.state?.layers ?? []) if (typeof layer.src === "string") srcs.add(layer.src);
    if (typeof page.state?.background?.file === "string") srcs.add(page.state.background.file);
  }
  // A video pasted from Motions shows its poster in stills (PDF, PPTX, thumbnails); deck.json names only the video.
  for (const src of [...srcs]) {
    const file = parsePresentationFile(src);
    const folder = file ? folders.get(file.pageId) : undefined;
    if (!file || !folder || !posterUrlFor(file.name) || !existsSync(join(folder, posterNameFor(file.name)))) continue;
    srcs.add(src.slice(0, src.length - file.name.length) + posterNameFor(file.name));
  }
  let bytes = 0;
  for (const src of srcs) {
    const file = parsePresentationFile(src);
    if (!file) continue;
    const folder = folders.get(file.pageId);
    const from = folder ? join(folder, file.name) : "";
    if (!from || !existsSync(from)) {
      console.warn(`WARN: ${projectId} ${src} is on a default page but missing from its page folder`);
      continue;
    }
    const to = join(appDir, PRESENTATION_STATIC_DIR, projectId, file.pageId, file.name.normalize("NFC"));
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    bytes += statSync(to).size;
  }
  return bytes;
}

function folderBytes(dir: string): number {
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    const stat = statSync(file);
    bytes += stat.isDirectory() ? folderBytes(file) : stat.size;
  }
  return bytes;
}

console.log("\n==> Building the app (public/ data and assets included)");
run("npm", ["run", "build:ui"]);

console.log("\n==> Copying the page files each project's deck uses");
let mediaBytes = 0;
for (const [id, dir] of projectDirs()) {
  const bytes = copyProjectMedia(APP_DIR, id, dir);
  console.log(`${id} (${dir.split(/[\\/]/).pop()}): ${bytes} bytes`);
  mediaBytes += bytes;
}

const bundleBytes = folderBytes(APP_DIR);
console.log(`\npresentation media bytes: ${mediaBytes}`);
console.log(`bundle bytes: ${bundleBytes}`);
console.log(`GitHub Pages remaining: ${GITHUB_PAGES_MAX_BYTES - bundleBytes}`);
if (bundleBytes > GITHUB_PAGES_MAX_BYTES) {
  console.error(`FAIL: bundle bytes ${bundleBytes} exceed GitHub Pages ${GITHUB_PAGES_MAX_BYTES}`);
  process.exit(1);
}
console.log(`OK: site ready in ${APP_DIR}`);
