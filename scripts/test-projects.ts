/**
 * Projects (Dev Phase 2): the model, the browser store a deployed site uses, the dev server's project folders, and the addresses.
 * The dev server part runs in a temporary folder, never in this repo's presentation/.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cleanTitle,
  copyTitle,
  isProjectDir,
  isProjectId,
  newProjectPages,
  nextProjectDir,
  parseProjectMeta,
  relativeTime,
  sortProjects,
  storedProjectMeta,
  thumbnailPage,
  uniqueTitle,
  type ProjectMeta,
} from "../src/shared/projects.ts";
import {
  deckDefaults,
  LEGACY_DECK_KEY,
  loadPresentationDeck,
  migrateLegacyDeck,
  movePresentationPages,
  projectDeckKey,
  removePresentationPage,
  savePresentationDeck,
  storedDeck,
  type PresentationDeck,
} from "../src/shared/presentation.ts";
import { presentationFileUrl } from "../src/shared/presentation-files.ts";
import { cardIsBare } from "../src/shared/studio.ts";
import { hrefFor, parseHash } from "../src/router.ts";
import type { BuiltProject } from "../src/built-projects.ts";
import PROJECT_1 from "../presentation/project 1/project.json";
import PROJECT_1_DECK from "../presentation/project 1/deck.json";

const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
  },
});

// project 1 moved in from Phase 1
const project1 = parseProjectMeta(PROJECT_1, "project 1");
assert.ok(project1);
assert.equal(project1.id, "project-1");
assert.equal(project1.title, "2026 브루넬 연말행사");
assert.equal(project1.thumbnailPageId, null);
assert.equal(PROJECT_1_DECK.pages.length, 18);

// ids, folders, titles
assert.ok(isProjectId("project-1") && isProjectId("project-0f8e2c4a-1b2c-4d5e-8f90-123456789abc"));
for (const bad of ["project 1", "../project-1", "project-", "page-01", "project-a/b", ""]) assert.equal(isProjectId(bad), false, bad);
assert.ok(isProjectDir("project 1") && isProjectDir("project 12"));
for (const bad of ["project 0", "project-1", "project 1/..", "..", "project 01"]) assert.equal(isProjectDir(bad), false, bad);
assert.equal(nextProjectDir([]), "project 1");
assert.equal(nextProjectDir(["project 1", "project 3", "progressive-blur.js"]), "project 4");
assert.equal(cleanTitle("  두   칸  "), "두 칸");
assert.equal(cleanTitle("   "), null);
assert.equal(cleanTitle(42), null);
assert.equal(cleanTitle("가".repeat(100))?.length, 80);
assert.equal(uniqueTitle("새 프로젝트", []), "새 프로젝트");
assert.equal(uniqueTitle("새 프로젝트", ["새 프로젝트"]), "새 프로젝트 2");
assert.equal(uniqueTitle("새 프로젝트", ["새 프로젝트", "새 프로젝트 2"]), "새 프로젝트 3");
assert.equal(copyTitle("발표", []), "발표 복사본");
assert.equal(copyTitle("발표", ["발표 복사본"]), "발표 복사본 2");

// a new project: page 1 type 1, pages 2 to 5 empty in the app's mode
const fresh = newProjectPages("dark");
assert.equal(fresh.length, 5);
assert.equal(fresh[0]?.type, 1);
assert.equal(fresh[0]?.state.background?.id, "slide");
assert.ok(fresh.slice(1).every((page) => cardIsBare(page.state)));
assert.equal(new Set(fresh.map((page) => page.id)).size, 5);
assert.notEqual(newProjectPages("light")[1]?.state.color, fresh[1]?.state.color);

// thumbnail page: the chosen page wherever it moves, page 1 once it is gone
const deck: PresentationDeck = { selected: 0, pages: newProjectPages("dark") };
const third = deck.pages[2]!;
assert.equal(thumbnailPage(deck.pages, null), deck.pages[0]);
assert.equal(thumbnailPage(deck.pages, third.id), third);
assert.ok(movePresentationPages(deck, [2], 5));
assert.equal(deck.pages[4], third);
assert.equal(thumbnailPage(deck.pages, third.id), third);
assert.ok(removePresentationPage(deck, 4));
assert.equal(thumbnailPage(deck.pages, third.id), deck.pages[0]);
assert.equal(thumbnailPage([], null), null);

// sort and relative time
const meta = (id: string, title: string, createdAt: string, updatedAt: string): ProjectMeta => ({ id, dir: "", title, thumbnailPageId: null, createdAt, updatedAt });
const metas = [
  meta("project-a", "발표 10", "2026-01-01T00:00:00Z", "2026-03-01T00:00:00Z"),
  meta("project-b", "발표 2", "2026-02-01T00:00:00Z", "2026-02-01T00:00:00Z"),
  meta("project-c", "Alpha", "2026-03-01T00:00:00Z", "2026-01-01T00:00:00Z"),
];
assert.deepEqual(sortProjects(metas, "updated").map((item) => item.id), ["project-a", "project-b", "project-c"]);
assert.deepEqual(sortProjects(metas, "created").map((item) => item.id), ["project-c", "project-b", "project-a"]);
assert.deepEqual(sortProjects(metas, "title").map((item) => item.title), ["발표 2", "발표 10", "Alpha"], "Korean order, numbers by value");
const now = Date.parse("2026-11-24T12:00:00Z");
const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();
assert.equal(relativeTime(ago(5), now), "방금 수정");
assert.equal(relativeTime(ago(-60), now), "방금 수정");
assert.equal(relativeTime(ago(5 * 60), now), "5분 전 수정");
assert.equal(relativeTime(ago(3 * 3600), now), "3시간 전 수정");
assert.equal(relativeTime(ago(9 * 86400), now), "9일 전 수정");
assert.equal(relativeTime(ago(65 * 86400), now), "2개월 전 수정");
assert.equal(relativeTime(ago(800 * 86400), now), "2년 전 수정");
assert.deepEqual(Object.keys(storedProjectMeta(project1)), ["id", "title", "thumbnailPageId", "createdAt", "updatedAt"]);

// Phase 1's working deck moves to project-1 once and keeps its pages
store.clear();
const legacy = { ...storedDeck(newProjectPages("dark")), defaults: "x" };
store.set(LEGACY_DECK_KEY, JSON.stringify(legacy));
migrateLegacyDeck();
assert.equal(store.has(LEGACY_DECK_KEY), false);
assert.equal(store.get(projectDeckKey("project-1")), JSON.stringify(legacy));
store.set(LEGACY_DECK_KEY, "{}");
migrateLegacyDeck();
assert.equal(store.get(projectDeckKey("project-1")), JSON.stringify(legacy), "an existing project-1 deck is not replaced");
const fallback = () => ({ selected: 0, pages: [] });
assert.equal(loadPresentationDeck("project-1", null, fallback).pages.length, 5);

// a deployed site: a save made against an older deck.json gives way, a browser project's save is the project
const defaults = deckDefaults(PROJECT_1_DECK.pages);
savePresentationDeck("project-1", { selected: 0, pages: newProjectPages("dark") }, deckDefaults([{}]));
assert.equal(loadPresentationDeck("project-1", defaults, fallback).pages.length, 18);
savePresentationDeck("project-1", { selected: 0, pages: newProjectPages("dark") }, defaults);
assert.equal(loadPresentationDeck("project-1", defaults, fallback).pages.length, 5);
savePresentationDeck("project-x", { selected: 0, pages: newProjectPages("dark").slice(0, 2) }, null);
assert.equal(loadPresentationDeck("project-x", null, fallback).pages.length, 2);

// page files: the same page id in two projects reads two folders
assert.equal(presentationFileUrl("pres:page-01/a.png", "project-1"), "presentation-media/project-1/page-01/a.png");
assert.equal(presentationFileUrl("pres:page-01/a.png", "project-2"), "presentation-media/project-2/page-01/a.png");
assert.equal(presentationFileUrl("pres:page-01/a.png", undefined), null);
assert.equal(presentationFileUrl("conf:logo", "project-1"), null);

// The store as a deployed site uses it: built projects plus this browser's, minus the ones deleted here
store.clear();
const storeModule = await import("../src/projects-store.ts");
const built: BuiltProject[] = [{ dir: "project 1", meta: PROJECT_1, deck: PROJECT_1_DECK, thumbnail: "assets/thumbnail.webp" }];
assert.equal(storeModule.projectsOnDisk(), false);
assert.equal(await storeModule.loadProjects(built), true);
const ids = () => storeModule.listProjects().map((project) => project.meta.id);
assert.deepEqual(ids(), ["project-1"]);
const p1 = storeModule.findProject("project-1")!;
assert.equal(p1.origin, "build");
assert.equal(p1.thumbnail, "assets/thumbnail.webp");
assert.equal(storeModule.projectDeck(p1, "dark").pages.length, 18);

const made = await storeModule.createProject("dark");
assert.ok(made);
assert.equal(made.origin, "browser");
assert.equal(made.meta.title, "새 프로젝트");
assert.equal(storeModule.projectDeck(made, "dark").pages.length, 5);
const second = await storeModule.createProject("dark");
assert.equal(second?.meta.title, "새 프로젝트 2");

const copy = await storeModule.duplicateProject(p1, "dark");
assert.ok(copy);
assert.equal(copy.meta.title, "2026 브루넬 연말행사 복사본");
assert.equal(copy.media, "project-1", "a browser copy reads its source's page files");
assert.equal(storeModule.projectDeck(copy, "dark").pages[0]?.id, storeModule.projectDeck(p1, "dark").pages[0]?.id, "page ids stay");
storeModule.projectDeck(copy, "dark").pages.pop();
assert.equal(storeModule.projectDeck(p1, "dark").pages.length, 18, "the copy is its own deck");

assert.equal(await storeModule.renameProject(p1, "   "), false);
assert.equal(await storeModule.renameProject(p1, "브라우저 제목"), true);
assert.equal(await storeModule.setThumbnailPage(made, storeModule.projectDeck(made, "dark").pages[2]!.id), true);
const before = made.meta.updatedAt;
await new Promise((resolve) => setTimeout(resolve, 5));
const madeDeck = storeModule.projectDeck(made, "dark");
madeDeck.selected = 3;
assert.ok(storeModule.saveProjectDeck(made, madeDeck));
assert.equal(made.meta.updatedAt, before, "moving the selection is not an edit");
madeDeck.pages[1]!.name = "intro";
assert.ok(storeModule.saveProjectDeck(made, madeDeck));
assert.ok(Date.parse(made.meta.updatedAt) > Date.parse(before), "a page change is");
storeModule.setLastOpened(made.meta.id);
storeModule.writeProjectsView({ sort: "title", view: "list" });

// a reload keeps all of it
assert.equal(await storeModule.loadProjects(built), true);
assert.deepEqual(ids().sort(), [copy.meta.id, made.meta.id, "project-1", second!.meta.id].sort());
assert.equal(storeModule.findProject("project-1")?.meta.title, "브라우저 제목");
assert.equal(storeModule.findProject("project-1")?.thumbnailSource, null, "thumbnail.webp still shows the built page");
const reloaded = storeModule.findProject(made.meta.id)!;
assert.equal(reloaded.meta.thumbnailPageId, madeDeck.pages[2]!.id);
assert.equal(storeModule.projectDeck(reloaded, "dark").pages[1]?.name, "intro");
assert.equal(storeModule.projectDeck(storeModule.findProject(copy.meta.id)!, "dark").pages.length, 18);
assert.equal(storeModule.lastOpened(), made.meta.id);
assert.deepEqual(storeModule.readProjectsView(), { sort: "title", view: "list" });

// 리셋 reopens built decks from deck.json and leaves browser projects alone
const opened = storeModule.projectDeck(storeModule.findProject("project-1")!, "dark");
opened.pages.splice(1);
storeModule.saveProjectDeck(storeModule.findProject("project-1")!, opened);
storeModule.resetDecks();
assert.equal(storeModule.projectDeck(storeModule.findProject("project-1")!, "dark").pages.length, 18);
assert.equal(storeModule.projectDeck(storeModule.findProject(made.meta.id)!, "dark").pages[1]?.name, "intro");

// delete: a browser project goes, a built one is hidden in this browser
assert.ok(await storeModule.deleteProject(storeModule.findProject(made.meta.id)!));
assert.equal(store.has(projectDeckKey(made.meta.id)), false);
assert.equal(storeModule.lastOpened(), null);
assert.ok(await storeModule.deleteProject(storeModule.findProject("project-1")!));
assert.equal(await storeModule.loadProjects(built), true);
assert.equal(ids().includes("project-1"), false);
assert.equal(ids().includes(made.meta.id), false);
for (const id of ids()) assert.ok(await storeModule.deleteProject(storeModule.findProject(id)!));
assert.equal(await storeModule.loadProjects(built), true);
assert.deepEqual(ids(), []);

// The dev server's folders, in a temporary working directory
const { applyProjectAction, BadRequest, listProjects } = await import("./projects.ts");
const cwd = process.cwd();
const temp = mkdtempSync(join(tmpdir(), "ax-projects-"));
try {
  process.chdir(temp);
  mkdirSync(join("presentation", "project 1", "pages", "page 1"), { recursive: true });
  writeFileSync(join("presentation", "project 1", "project.json"), JSON.stringify({ ...PROJECT_1 }));
  writeFileSync(join("presentation", "project 1", "deck.json"), JSON.stringify(storedDeck(newProjectPages("dark").slice(0, 1))));
  writeFileSync(join("presentation", "progressive-blur.js"), "");
  const one = JSON.parse(readFileSync(join("presentation", "project 1", "deck.json"), "utf8")) as { pages: { id: string }[] };
  writeFileSync(join("presentation", "project 1", "pages", "page 1", "page.json"), JSON.stringify({ id: one.pages[0]!.id, placed: ["a.png"] }));
  writeFileSync(join("presentation", "project 1", "pages", "page 1", "a.png"), "png");
  assert.deepEqual(listProjects().map((item) => item.id), ["project-1"]);

  const created = applyProjectAction({ action: "create", title: "새 프로젝트", deck: storedDeck(newProjectPages("dark")) })!;
  assert.equal(created.dir, "project 2");
  assert.deepEqual(readdirSync(join("presentation", "project 2", "pages")).sort(), ["page 1", "page 2", "page 3", "page 4", "page 5"]);
  assert.equal(JSON.parse(readFileSync(join("presentation", "project 2", "deck.json"), "utf8")).pages.length, 5);

  const copied = applyProjectAction({ action: "duplicate", source: "project-1", title: "2026 브루넬 연말행사 복사본", deck: JSON.parse(readFileSync(join("presentation", "project 1", "deck.json"), "utf8")) })!;
  assert.equal(copied.dir, "project 3");
  assert.equal(readFileSync(join("presentation", "project 3", "pages", "page 1", "a.png"), "utf8"), "png");
  assert.equal(JSON.parse(readFileSync(join("presentation", "project 3", "pages", "page 1", "page.json"), "utf8")).id, one.pages[0]!.id);

  assert.equal(applyProjectAction({ action: "rename", id: copied.id, title: "바뀐 제목" })?.title, "바뀐 제목");
  assert.equal(applyProjectAction({ action: "thumbnail-page", id: copied.id, pageId: one.pages[0]!.id })?.thumbnailPageId, one.pages[0]!.id);
  assert.equal(listProjects().find((item) => item.id === copied.id)?.dir, "project 3", "the folder keeps its name");

  for (const body of [
    { action: "delete", id: "../project 1" },
    { action: "delete", id: "project 1" },
    { action: "delete", id: "project-nope" },
    { action: "rename", id: copied.id, title: " " },
    { action: "deck", id: copied.id, deck: { pages: [] } },
    { action: "thumbnail", id: copied.id, image: "data:image/png;base64,AA" },
    { action: "duplicate", source: "project-nope", title: "x", deck: storedDeck(newProjectPages("dark")) },
  ] as const) {
    assert.throws(() => applyProjectAction(body), BadRequest, JSON.stringify(body));
  }
  assert.equal(readdirSync("presentation").length, 4);

  applyProjectAction({ action: "delete", id: created.id });
  assert.equal(existsSync(join("presentation", "project 2")), false);
  assert.ok(existsSync(join("presentation", "project 1", "pages", "page 1", "a.png")));
  assert.equal(nextProjectDir(readdirSync("presentation")), "project 4", "a deleted number in the middle is not reused");
} finally {
  process.chdir(cwd);
  rmSync(temp, { recursive: true, force: true });
}

// Addresses: Projects first, then one project in the Presentation
assert.deepEqual(parseHash("#/projects"), { name: "projects" });
assert.deepEqual(parseHash("#/projects/"), { name: "projects" });
assert.deepEqual(parseHash("#/presentation/project-1"), { name: "presentation", project: "project-1" });
assert.deepEqual(parseHash(""), { name: "notfound", path: "/" });
assert.equal(parseHash("#/studio").name, "notfound");
assert.equal(parseHash("#/presentation/../x").name, "notfound");
assert.equal(hrefFor({ name: "projects" }), "#/projects");

console.log("OK: project model, new project, thumbnail page, sort, relative time, titles, migration, browser store, dev server folders, and routes");
