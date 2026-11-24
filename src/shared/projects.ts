/**
 * A project is one deck kept in presentation/<dir>/: project.json, deck.json, thumbnail.webp, and pages/page N/.
 * Pure helpers shared by the app, the dev server, and the tests.
 */
import { createBlankPage, createTypedPage, type PresentationPage, type PresentationTone } from "./presentation.ts";

export type ProjectMeta = {
  /** "project-1", or "project-<uuid>" for a new project. */
  id: string;
  /** Folder under presentation/, "project 1". Stays the same when the title changes. */
  dir: string;
  title: string;
  /** Page shown on the project card. Null, or a page that is gone, means page 1. */
  thumbnailPageId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A project as GET /__projects lists it: project.json and its folder, deck.json, and thumbnail.webp's mtime while it is up to date with them. */
export type ListedProject = ProjectMeta & { deck: unknown; thumbnail: number | null };

export type ProjectSort = "updated" | "title" | "created";
export type ProjectView = "grid" | "list";

export const PROJECTS_DIR = "presentation";
export const PROJECT_FILE = "project.json";
export const PROJECT_DECK_FILE = "deck.json";
export const PROJECT_THUMB_FILE = "thumbnail.webp";
export const PROJECT_PAGES_DIR = "pages";
export const PROJECTS_ROUTE = "/__projects";
export const NEW_PROJECT_TITLE = "새 프로젝트";
export const NEW_PROJECT_PAGES = 5;
export const TITLE_MAX = 80;

const ID = /^project-[A-Za-z0-9-]{1,64}$/;
const DIR = /^project ([1-9]\d{0,5})$/;

export function isProjectId(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

export function isProjectDir(value: unknown): value is string {
  return typeof value === "string" && DIR.test(value);
}

export function newProjectId(): string {
  return `project-${crypto.randomUUID()}`;
}

/** "project N" with N one past the largest in use. A gap left by a deleted project is not filled. */
export function nextProjectDir(dirs: readonly string[]): string {
  const top = dirs.reduce((max, dir) => {
    const match = DIR.exec(dir);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `project ${top + 1}`;
}

/** A title as typed: trimmed and cut to TITLE_MAX. Null when it is empty. */
export function cleanTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const title = raw.replace(/\s+/g, " ").trim().slice(0, TITLE_MAX).trim();
  return title || null;
}

/** `base`, or `base 2`, `base 3`, … when that title is taken. */
export function uniqueTitle(base: string, taken: readonly string[]): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

export function copyTitle(title: string, taken: readonly string[]): string {
  return uniqueTitle(`${title} 복사본`.slice(-TITLE_MAX).trim(), taken);
}

/** A new project's deck: page 1 is type 1, pages 2 to 5 are empty. */
export function newProjectPages(tone: PresentationTone): PresentationPage[] {
  const pages = [createTypedPage(1, null, tone)];
  while (pages.length < NEW_PROJECT_PAGES) pages.push(createBlankPage(tone));
  return pages;
}

/** The page on the card: the chosen one, or page 1 when none is chosen or it was deleted. */
export function thumbnailPage<T extends { id: string }>(pages: readonly T[], thumbnailPageId: string | null): T | null {
  return (thumbnailPageId ? pages.find((page) => page.id === thumbnailPageId) : undefined) ?? pages[0] ?? null;
}

function time(iso: string): number {
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : 0;
}

/** Last modified and created are newest first. Name is ascending, with numbers in order. */
export function sortProjects<T extends ProjectMeta>(list: readonly T[], sort: ProjectSort): T[] {
  const byTitle = (a: T, b: T) => a.title.localeCompare(b.title, "ko", { numeric: true }) || a.id.localeCompare(b.id);
  return [...list].sort((a, b) => {
    if (sort === "title") return byTitle(a, b);
    const key = sort === "created" ? "createdAt" : "updatedAt";
    return time(b[key]) - time(a[key]) || byTitle(a, b);
  });
}

/** "방금 수정", "5분 전 수정", … "2년 전 수정". */
export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.floor((now - time(iso)) / 1000);
  if (!Number.isFinite(seconds) || seconds < 60) return "방금 수정";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전 수정`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전 수정`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전 수정`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전 수정`;
  return `${Math.floor(days / 365)}년 전 수정`;
}

/** "2026. 11. 22." */
export function shortDate(iso: string): string {
  const date = new Date(time(iso));
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
}

function isoOr(value: unknown, fallback: string): string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : fallback;
}

/** project.json as read from disk or a build. `dir` comes from where it was found. */
export function parseProjectMeta(raw: unknown, dir: string): ProjectMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const title = cleanTitle(value.title);
  if (!isProjectId(value.id) || !title) return null;
  const createdAt = isoOr(value.createdAt, new Date(0).toISOString());
  return {
    id: value.id,
    dir,
    title,
    thumbnailPageId: typeof value.thumbnailPageId === "string" && value.thumbnailPageId ? value.thumbnailPageId : null,
    createdAt,
    updatedAt: isoOr(value.updatedAt, createdAt),
  };
}

/** What project.json holds: the meta without the folder name. */
export function storedProjectMeta({ id, title, thumbnailPageId, createdAt, updatedAt }: ProjectMeta) {
  return { id, title, thumbnailPageId, createdAt, updatedAt };
}
