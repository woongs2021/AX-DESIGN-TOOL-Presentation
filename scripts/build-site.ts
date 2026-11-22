/**
 * Builds the Presentation as a static site in dist/app: the app with public/ (data and assets),
 * then the page-folder files the default deck uses, where presentationFileUrl looks off localhost.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { GITHUB_PAGES_MAX_BYTES } from "../src/shared/limits.ts";
import { PRESENTATION_STATIC_DIR, parsePresentationFile } from "../src/shared/presentation-files.ts";

const APP_DIR = "dist/app";

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/** Copies the page-folder files the default deck uses next to the app. Returns their bytes. */
function copyPresentationMedia(appDir: string): number {
  const root = join("presentation", "project 1", "pages");
  const folders = new Map<string, string>();
  for (const name of existsSync(root) ? readdirSync(root) : []) {
    const meta = join(root, name, "page.json");
    if (!existsSync(meta)) continue;
    const id = (JSON.parse(readFileSync(meta, "utf8")) as { id?: unknown }).id;
    if (typeof id === "string") folders.set(id, join(root, name));
  }
  const deck = JSON.parse(readFileSync(join("src", "shared", "presentation-defaults.json"), "utf8")) as {
    pages?: { state?: { layers?: { src?: unknown }[]; background?: { file?: unknown } } }[];
  };
  const srcs = new Set<string>();
  for (const page of deck.pages ?? []) {
    for (const layer of page.state?.layers ?? []) if (typeof layer.src === "string") srcs.add(layer.src);
    if (typeof page.state?.background?.file === "string") srcs.add(page.state.background.file);
  }
  let bytes = 0;
  for (const src of srcs) {
    const file = parsePresentationFile(src);
    if (!file) continue;
    const folder = folders.get(file.pageId);
    const from = folder ? join(folder, file.name) : "";
    if (!from || !existsSync(from)) {
      console.warn(`WARN: ${src} is on a default page but missing from its page folder`);
      continue;
    }
    const to = join(appDir, PRESENTATION_STATIC_DIR, file.pageId, file.name.normalize("NFC"));
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

console.log("\n==> Copying presentation page files the default deck uses");
const mediaBytes = copyPresentationMedia(APP_DIR);

const bundleBytes = folderBytes(APP_DIR);
console.log(`\npresentation media bytes: ${mediaBytes}`);
console.log(`bundle bytes: ${bundleBytes}`);
console.log(`GitHub Pages remaining: ${GITHUB_PAGES_MAX_BYTES - bundleBytes}`);
if (bundleBytes > GITHUB_PAGES_MAX_BYTES) {
  console.error(`FAIL: bundle bytes ${bundleBytes} exceed GitHub Pages ${GITHUB_PAGES_MAX_BYTES}`);
  process.exit(1);
}
console.log(`OK: site ready in ${APP_DIR}`);
