/**
 * Projects on disk: presentation/project N/ with project.json, deck.json, thumbnail.webp, and pages/.
 * GET /__projects lists them with their decks. POST /__projects creates, duplicates, renames, and deletes them,
 * and writes the thumbnail page, the thumbnail image, and the deck (기본값 세팅). Localhost dev server only.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { pageAssetKeys, readStoredDeck, storedDeck } from "../src/shared/presentation.ts";
import {
  cleanTitle,
  isProjectDir,
  isProjectId,
  newProjectId,
  nextProjectDir,
  parseProjectMeta,
  PROJECT_DECK_FILE,
  PROJECT_FILE,
  PROJECT_PAGES_DIR,
  PROJECT_THUMB_FILE,
  PROJECTS_ROUTE,
  storedProjectMeta,
  type ListedProject,
  type ProjectMeta,
} from "../src/shared/projects.ts";
import { inside, projectDirs, projectsRoot, syncFolders } from "./presentation-project.ts";

/** A deck is about 80KB; a thumbnail is a 960×540 WebP. */
const BODY_LIMIT = 32 * 1024 * 1024;

type Action =
  | { action: "create"; title?: unknown; deck?: unknown }
  | { action: "duplicate"; source?: unknown; title?: unknown; deck?: unknown }
  | { action: "rename"; id?: unknown; title?: unknown }
  | { action: "delete"; id?: unknown }
  | { action: "thumbnail-page"; id?: unknown; pageId?: unknown }
  | { action: "thumbnail"; id?: unknown; image?: unknown }
  | { action: "deck"; id?: unknown; deck?: unknown };

export class BadRequest extends Error {}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as unknown;
  } catch {
    return null;
  }
}

function writeJson(file: string, value: unknown): void {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function mtime(file: string): number | null {
  return existsSync(file) ? statSync(file).mtimeMs : null;
}

/** thumbnail.webp's mtime when it is at least as new as deck.json and project.json, so it still shows deck.json's thumbnail page. */
function freshThumbnail(dir: string): number | null {
  const thumb = mtime(join(dir, PROJECT_THUMB_FILE));
  if (thumb == null) return null;
  const inputs = Math.max(mtime(join(dir, PROJECT_DECK_FILE)) ?? 0, mtime(join(dir, PROJECT_FILE)) ?? 0);
  return thumb >= inputs ? Math.round(thumb) : null;
}

function readProject(dir: string): ListedProject | null {
  const meta = parseProjectMeta(readJson(join(dir, PROJECT_FILE)), basename(dir));
  if (!meta) return null;
  return { ...meta, deck: readJson(join(dir, PROJECT_DECK_FILE)), thumbnail: freshThumbnail(dir) };
}

export function listProjects(): ListedProject[] {
  return [...projectDirs().values()].flatMap((dir) => readProject(dir) ?? []);
}

function projectAt(id: unknown): { dir: string; meta: ProjectMeta } {
  const dir = isProjectId(id) ? projectDirs().get(id) : undefined;
  const meta = dir ? parseProjectMeta(readJson(join(dir, PROJECT_FILE)), basename(dir)) : null;
  if (!dir || !meta || !inside(projectsRoot(), dir)) throw new BadRequest("project");
  return { dir, meta };
}

function writeMeta(dir: string, meta: ProjectMeta): void {
  writeJson(join(dir, PROJECT_FILE), storedProjectMeta(meta));
}

/** The deck as deck.json stores it. Throws when it does not parse. */
function deckBody(raw: unknown) {
  const deck = readStoredDeck(raw);
  if (!deck) throw new BadRequest("deck");
  return { deck, body: storedDeck(deck.pages) };
}

function syncPages(dir: string, pages: ReturnType<typeof deckBody>["deck"]["pages"]): void {
  syncFolders(join(dir, PROJECT_PAGES_DIR), pages.map((page) => ({ id: page.id, copy: pageAssetKeys(page) })));
}

function newFolder(): string {
  const root = projectsRoot();
  mkdirSync(root, { recursive: true });
  const taken = readdirSync(root).filter((name) => isProjectDir(name));
  const dir = join(root, nextProjectDir(taken));
  if (existsSync(dir)) throw new BadRequest("dir");
  mkdirSync(dir);
  return dir;
}

function create(title: unknown, rawDeck: unknown): ListedProject {
  const name = cleanTitle(title);
  if (!name) throw new BadRequest("title");
  const { deck, body } = deckBody(rawDeck);
  const dir = newFolder();
  const now = new Date().toISOString();
  const meta: ProjectMeta = { id: newProjectId(), dir: basename(dir), title: name, thumbnailPageId: null, createdAt: now, updatedAt: now };
  writeMeta(dir, meta);
  writeJson(join(dir, PROJECT_DECK_FILE), body);
  syncPages(dir, deck.pages);
  return readProject(dir)!;
}

/** Copies the source's page folders, then writes the deck the user was looking at. */
function duplicate(source: unknown, title: unknown, rawDeck: unknown): ListedProject {
  const from = projectAt(source);
  const name = cleanTitle(title);
  if (!name) throw new BadRequest("title");
  const { deck, body } = deckBody(rawDeck);
  const dir = newFolder();
  const pages = join(from.dir, PROJECT_PAGES_DIR);
  if (existsSync(pages)) cpSync(pages, join(dir, PROJECT_PAGES_DIR), { recursive: true });
  const now = new Date().toISOString();
  const meta: ProjectMeta = {
    id: newProjectId(),
    dir: basename(dir),
    title: name,
    thumbnailPageId: from.meta.thumbnailPageId,
    createdAt: now,
    updatedAt: now,
  };
  writeMeta(dir, meta);
  writeJson(join(dir, PROJECT_DECK_FILE), body);
  syncPages(dir, deck.pages);
  return readProject(dir)!;
}

/** One POST /__projects action against presentation/ in the working directory. Throws BadRequest for a bad id, title, deck, or path. */
export function applyProjectAction(body: Action): ListedProject | null {
  if (body.action === "create") return create(body.title, body.deck);
  if (body.action === "duplicate") return duplicate(body.source, body.title, body.deck);
  const { dir, meta } = projectAt(body.id);
  if (body.action === "rename") {
    const title = cleanTitle(body.title);
    if (!title) throw new BadRequest("title");
    writeMeta(dir, { ...meta, title });
  } else if (body.action === "delete") {
    // Only presentation/project N/ itself, never a parent or a sibling.
    if (!isProjectDir(basename(dir)) || !inside(projectsRoot(), dir) || dir === projectsRoot()) throw new BadRequest("dir");
    rmSync(dir, { recursive: true, force: true });
    return null;
  } else if (body.action === "thumbnail-page") {
    const pageId = body.pageId === null ? null : typeof body.pageId === "string" && /^[\w-]+$/.test(body.pageId) ? body.pageId : undefined;
    if (pageId === undefined) throw new BadRequest("page");
    writeMeta(dir, { ...meta, thumbnailPageId: pageId });
  } else if (body.action === "thumbnail") {
    const match = typeof body.image === "string" ? /^data:image\/webp;base64,([A-Za-z0-9+/=]+)$/.exec(body.image) : null;
    if (!match?.[1]) throw new BadRequest("image");
    writeFileSync(join(dir, PROJECT_THUMB_FILE), Buffer.from(match[1], "base64"));
  } else if (body.action === "deck") {
    const { body: stored } = deckBody(body.deck);
    writeJson(join(dir, PROJECT_DECK_FILE), stored);
    writeMeta(dir, { ...meta, updatedAt: new Date().toISOString() });
  } else {
    throw new BadRequest("action");
  }
  return readProject(dir);
}

function loopback(req: IncomingMessage): boolean {
  const host = (req.headers.host ?? "").replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new Error("body"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body?: unknown): void {
  res.statusCode = status;
  if (body === undefined) {
    res.end();
    return;
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export function projectsRoutes(): Plugin {
  return {
    name: "projects",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url !== PROJECTS_ROUTE && !url.startsWith(`${PROJECTS_ROUTE}/`)) {
          next();
          return;
        }
        if (!loopback(req)) {
          send(res, 403);
          return;
        }
        // GET /__projects/<id>/thumbnail.webp
        if (url !== PROJECTS_ROUTE) {
          const [id, file, ...rest] = url.slice(PROJECTS_ROUTE.length + 1).split("/").map((part) => decodeURIComponent(part));
          const dir = isProjectId(id) && file === PROJECT_THUMB_FILE && !rest.length ? projectDirs().get(id) : undefined;
          const thumb = dir ? join(dir, PROJECT_THUMB_FILE) : "";
          if (req.method !== "GET" || !thumb || !existsSync(thumb)) {
            send(res, 404);
            return;
          }
          res.setHeader("Content-Type", "image/webp");
          res.setHeader("Cache-Control", "no-cache");
          res.end(readFileSync(thumb));
          return;
        }
        if (req.method === "GET") {
          send(res, 200, { projects: listProjects() });
          return;
        }
        if (req.method !== "POST") {
          send(res, 405);
          return;
        }
        try {
          const body = JSON.parse(await readBody(req)) as Action;
          const project = applyProjectAction(body);
          send(res, 200, { project });
        } catch (error) {
          send(res, error instanceof BadRequest || error instanceof SyntaxError ? 400 : 500);
        }
      });
    },
  };
}
