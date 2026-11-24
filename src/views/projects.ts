/**
 * Projects tab: every presentation as a thumbnail card (grid) or a row (list).
 * A card opens its project in the Presentation tab. ⋯ or a right click offers open, rename, duplicate, and delete.
 */
import type { ConferenceIndex } from "../shared/conference.ts";
import { pageTitle, type PresentationTone } from "../shared/presentation.ts";
import { cleanTitle, relativeTime, shortDate, sortProjects, type ProjectSort, type ProjectView } from "../shared/projects.ts";
import {
  createProject,
  deleteProject,
  duplicateProject,
  findProject,
  listProjects,
  projectDeck,
  projectsOnDisk,
  readProjectsView,
  renameProject,
  writeProjectsView,
  type Project,
} from "../projects-store.ts";
import { confirmProceed, showToast } from "../feedback.ts";
import { hrefFor } from "../router.ts";
import { cardPage, dropProjectThumb, knownThumb, projectThumb } from "./project-thumbs.ts";

const SORT_LABEL: Record<ProjectSort, string> = { updated: "최근 수정", title: "이름", created: "만든 날짜" };
const MENU: { action: "open" | "rename" | "duplicate" | "delete"; label: string }[] = [
  { action: "open", label: "열기" },
  { action: "rename", label: "제목 바꾸기" },
  { action: "duplicate", label: "복제" },
  { action: "delete", label: "삭제" },
];

/** Card whose title is being typed. A new project starts here. */
let renamingId: string | null = null;
let thumbJob = 0;
let busy = false;
let stopMenu: (() => void) | null = null;

const icon = (paths: string, extra = "") => `<svg class="studio__icon${extra}" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const DECK_ICON = icon('<path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"/><path d="M12 16.5v3M8.5 19.5h7"/>');
const FOLDER_ICON = icon('<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>', " projects__title-icon");
const GRID_ICON = icon('<path d="M4.5 4.5h6v6h-6ZM13.5 4.5h6v6h-6ZM4.5 13.5h6v6h-6ZM13.5 13.5h6v6h-6Z"/>');
const LIST_ICON = icon('<path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>');
const MORE_ICON = icon('<path d="M6 12h.01M12 12h.01M18 12h.01"/>');
const BACK_ICON = icon('<path d="M14.5 6 8.5 12l6 6"/>');
const FORWARD_ICON = icon('<path d="m9.5 6 6 6-6 6"/>');

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function sorted(sort: ProjectSort): Project[] {
  const byId = new Map(listProjects().map((project) => [project.meta.id, project]));
  return sortProjects(listProjects().map((project) => project.meta), sort).flatMap((meta) => byId.get(meta.id) ?? []);
}

function card(project: Project, tone: PresentationTone, now: number): string {
  const { id, title, createdAt, updatedAt } = project.meta;
  const deck = projectDeck(project, tone);
  const page = cardPage(project, deck);
  const known = knownThumb(project, deck);
  const name = escapeHtml(title);
  const edited = relativeTime(updatedAt, now);
  const local = project.origin === "browser" ? `<span class="project-card__local">이 브라우저에만 저장됨</span>` : "";
  const heading = renamingId === id
    ? `<input class="project-card__name" data-project-name="${id}" value="${name}" maxlength="80" aria-label="프로젝트 제목" />`
    : `<span class="project-card__title" data-project-title="${id}" title="${name}">${name}</span>`;
  return `
    <li class="project-card" data-project="${id}">
      <button type="button" class="project-card__open" data-project-open="${id}" aria-label="${name} 열기">
        <span class="project-card__thumb" style="background:${escapeHtml(page?.state.color ?? "transparent")}">
          <span class="project-card__placeholder" aria-hidden="true">${escapeHtml(page ? pageTitle(page) : "")}</span>
          <img alt=""${known ? ` src="${known}"` : ""}>
        </span>
      </button>
      <div class="project-card__info">
        <span class="project-card__icon">${DECK_ICON}</span>
        <div class="project-card__text">
          ${heading}
          <span class="project-card__meta"><span class="project-card__edited">${edited}</span>${local}</span>
        </div>
        <span class="project-card__col project-card__col--pages">${deck.pages.length}장</span>
        <span class="project-card__col project-card__col--created">${shortDate(createdAt)}</span>
        <span class="project-card__col project-card__col--updated">${edited.replace(/ 수정$/, "")}</span>
        <button type="button" class="project-card__more" data-project-menu="${id}" aria-label="${name} 메뉴" aria-haspopup="menu">${MORE_ICON}</button>
      </div>
    </li>`;
}

export function renderProjects(tone: PresentationTone): string {
  const { sort, view } = readProjectsView();
  const projects = sorted(sort);
  const now = Date.now();
  const sortOptions = (Object.keys(SORT_LABEL) as ProjectSort[])
    .map((key) => `<option value="${key}"${key === sort ? " selected" : ""}>${SORT_LABEL[key]}</option>`)
    .join("");
  const viewButton = (value: ProjectView, label: string, svg: string) =>
    `<button type="button" class="projects__view" data-projects-view="${value}" aria-pressed="${view === value ? "true" : "false"}" aria-label="${label}" title="${label}">${svg}</button>`;
  const body = projects.length
    ? `
      <div class="projects__list-head" aria-hidden="true">
        <span></span><span>이름</span><span class="projects__head-col--pages">페이지</span><span class="projects__head-col--created">만든 날짜</span><span class="projects__head-col--updated">수정</span><span></span>
      </div>
      <ul class="projects__cards" data-view="${view}" aria-label="프로젝트">${projects.map((project) => card(project, tone, now)).join("")}</ul>`
    : `
      <div class="projects__empty">
        <p class="projects__empty-text">프로젝트가 없습니다.</p>
        <button type="button" class="button" data-projects-new>+ 새 프로젝트</button>
      </div>`;
  return `
    <section class="projects" data-view="${view}" aria-labelledby="projects-title">
      <div class="projects__bar">
        <div class="projects__history">
          <button type="button" class="studio__zoom-btn" id="projects-back" aria-label="뒤로" title="뒤로">${BACK_ICON}</button>
          <button type="button" class="studio__zoom-btn" id="projects-forward" aria-label="앞으로" title="앞으로">${FORWARD_ICON}</button>
          <span class="projects__crumb">Projects</span>
        </div>
        <button type="button" class="button" data-projects-new>+ 새 프로젝트</button>
      </div>
      <div class="projects__head">
        <h1 class="projects__title" id="projects-title">${FOLDER_ICON}Projects</h1>
        <span class="projects__count">프로젝트 ${projects.length}개</span>
        <div class="projects__tools">
          <label class="projects__sort">
            <span class="projects__sort-label">정렬</span>
            <select class="projects__select" id="projects-sort">${sortOptions}</select>
          </label>
          <div class="projects__views" role="group" aria-label="보기">
            ${viewButton("grid", "그리드", GRID_ICON)}${viewButton("list", "리스트", LIST_ICON)}
          </div>
        </div>
      </div>
      ${body}
    </section>`;
}

/** Releases the card menu when the view is rebuilt or left. */
export function releaseProjectsMenu(): void {
  stopMenu?.();
  stopMenu = null;
  thumbJob += 1;
}

type Bind = { index: ConferenceIndex; tone: PresentationTone; onChange: () => void };

export function bindProjects(root: HTMLElement, { index, tone, onChange }: Bind): void {
  releaseProjectsMenu();
  const section = root.querySelector<HTMLElement>(".projects");
  if (!section) return;
  const open = (id: string) => {
    window.location.hash = hrefFor({ name: "presentation", project: id });
  };
  const run = async (task: () => Promise<void>) => {
    if (busy) return;
    busy = true;
    try {
      await task();
    } finally {
      busy = false;
    }
  };

  const nav = (window as { navigation?: { canGoBack?: boolean; canGoForward?: boolean } }).navigation;
  const back = section.querySelector<HTMLButtonElement>("#projects-back");
  const forward = section.querySelector<HTMLButtonElement>("#projects-forward");
  if (back) {
    back.disabled = nav?.canGoBack === false;
    back.addEventListener("click", () => history.back());
  }
  if (forward) {
    forward.disabled = nav?.canGoForward === false;
    forward.addEventListener("click", () => history.forward());
  }

  section.querySelectorAll<HTMLButtonElement>("[data-projects-new]").forEach((button) => {
    button.addEventListener("click", () => {
      void run(async () => {
        const project = await createProject(tone);
        if (!project) {
          showToast(projectsOnDisk() ? "새 프로젝트를 만들지 못했습니다." : "브라우저 저장 공간이 부족해 새 프로젝트를 만들지 못했습니다.");
          return;
        }
        renamingId = project.meta.id;
        onChange();
      });
    });
  });

  const sortSelect = section.querySelector<HTMLSelectElement>("#projects-sort");
  sortSelect?.addEventListener("change", () => {
    const value = sortSelect.value;
    const sort: ProjectSort = value === "title" || value === "created" ? value : "updated";
    writeProjectsView({ ...readProjectsView(), sort });
    onChange();
    root.querySelector<HTMLSelectElement>("#projects-sort")?.focus();
  });
  section.querySelectorAll<HTMLButtonElement>("[data-projects-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const view: ProjectView = button.dataset.projectsView === "list" ? "list" : "grid";
      if (readProjectsView().view === view) return;
      writeProjectsView({ ...readProjectsView(), view });
      onChange();
      root.querySelector<HTMLButtonElement>(`[data-projects-view="${view}"]`)?.focus();
    });
  });

  const rename = (id: string) => {
    renamingId = id;
    onChange();
  };
  const duplicate = (project: Project) =>
    run(async () => {
      const copy = await duplicateProject(project, tone);
      if (!copy) {
        showToast(projectsOnDisk() ? "프로젝트를 복제하지 못했습니다." : "브라우저 저장 공간이 부족해 복제하지 못했습니다.");
        return;
      }
      onChange();
      showToast(`'${copy.meta.title}'을 만들었습니다.`);
      root.querySelector<HTMLButtonElement>(`[data-project-open="${copy.meta.id}"]`)?.focus();
    });
  const remove = (project: Project) =>
    run(async () => {
      const lost = projectsOnDisk() ? " 커밋하지 않은 파일은 되돌릴 수 없습니다." : "";
      const ok = await confirmProceed(`'${project.meta.title}' 프로젝트를 삭제할까요? 페이지 폴더의 그림·영상도 함께 지워집니다.${lost}`);
      if (!ok) return;
      if (!(await deleteProject(project))) {
        showToast("프로젝트를 삭제하지 못했습니다.");
        return;
      }
      void dropProjectThumb(project.meta.id);
      if (renamingId === project.meta.id) renamingId = null;
      onChange();
      showToast("삭제했습니다.");
    });

  // Cards: a click anywhere opens; a click on the title waits for a possible double click, which renames.
  let titleTimer = 0;
  section.querySelectorAll<HTMLElement>(".project-card").forEach((item) => {
    const id = item.dataset.project ?? "";
    item.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest(".project-card__more, .project-card__name")) return;
      if (target.closest(".project-card__title")) {
        window.clearTimeout(titleTimer);
        titleTimer = window.setTimeout(() => open(id), 250);
        return;
      }
      open(id);
    });
    item.querySelector(".project-card__title")?.addEventListener("dblclick", (event) => {
      event.preventDefault();
      window.clearTimeout(titleTimer);
      rename(id);
    });
  });

  const input = section.querySelector<HTMLInputElement>(".project-card__name");
  if (input) {
    const id = input.dataset.projectName ?? "";
    let closed = false;
    const finish = async (save: boolean) => {
      if (closed) return;
      if (save && !cleanTitle(input.value)) {
        showToast("제목을 입력해 주세요.");
        return;
      }
      closed = true;
      const project = findProject(id);
      if (save && project && !(await renameProject(project, input.value))) showToast("제목을 바꾸지 못했습니다.");
      renamingId = null;
      onChange();
      root.querySelector<HTMLButtonElement>(`[data-project-open="${id}"]`)?.focus({ preventScroll: true });
    };
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        void finish(true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        void finish(false);
      }
    });
    // Leaving the field keeps a typed title; an empty one is dropped.
    input.addEventListener("blur", () => {
      window.setTimeout(() => void finish(cleanTitle(input.value) != null), 0);
    });
    input.scrollIntoView({ block: "nearest" });
    input.focus({ preventScroll: true });
    input.select();
  }

  bindMenu(section, { open, rename, duplicate: (project) => void duplicate(project), remove: (project) => void remove(project) });
  paintThumbs(section, index, tone);
}

type MenuActions = {
  open: (id: string) => void;
  rename: (id: string) => void;
  duplicate: (project: Project) => void;
  remove: (project: Project) => void;
};

function bindMenu(section: HTMLElement, actions: MenuActions): void {
  const menu = document.createElement("div");
  menu.className = "nav-popover studio-menu projects-menu";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "프로젝트 메뉴");
  menu.hidden = true;
  menu.innerHTML = MENU.map(
    (item) => `<button type="button" class="nav-popover__item" role="menuitem" data-menu-action="${item.action}">${item.label}</button>`,
  ).join("");
  document.body.append(menu);
  let target: string | null = null;
  let returnFocus: HTMLElement | null = null;
  const buttons = () => [...menu.querySelectorAll<HTMLButtonElement>("[data-menu-action]")];
  const close = (refocus = false) => {
    if (menu.hidden) return;
    menu.hidden = true;
    document.removeEventListener("pointerdown", onOutside, true);
    if (refocus) returnFocus?.focus({ preventScroll: true });
  };
  const onOutside = (event: PointerEvent) => {
    if (event.target instanceof Node && menu.contains(event.target)) return;
    close();
  };
  const show = (id: string, x: number, y: number, from: HTMLElement | null) => {
    target = id;
    returnFocus = from;
    menu.hidden = false;
    const margin = 8;
    const { width, height } = menu.getBoundingClientRect();
    const left = x + width + margin > window.innerWidth ? x - width : x;
    const top = y + height + margin > window.innerHeight ? y - height : y;
    menu.style.left = `${Math.max(margin, left)}px`;
    menu.style.top = `${Math.max(margin, top)}px`;
    document.addEventListener("pointerdown", onOutside, true);
    buttons()[0]?.focus({ preventScroll: true });
  };
  section.querySelectorAll<HTMLButtonElement>("[data-project-menu]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = button.dataset.projectMenu ?? "";
      if (!menu.hidden && target === id) {
        close(true);
        return;
      }
      const rect = button.getBoundingClientRect();
      show(id, rect.right - 4, rect.bottom + 4, button);
    });
  });
  const onContext = (event: MouseEvent) => {
    const cardEl = event.target instanceof Element ? event.target.closest<HTMLElement>(".project-card") : null;
    if (!cardEl || !section.contains(cardEl) || (event.target as Element).closest("input")) return;
    event.preventDefault();
    show(cardEl.dataset.project ?? "", event.clientX, event.clientY, cardEl.querySelector<HTMLElement>("[data-project-open]"));
  };
  section.addEventListener("contextmenu", onContext);
  menu.addEventListener("keydown", (event) => {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const list = buttons();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    list[(at + (event.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus();
  });
  menu.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-menu-action]") : null;
    const project = findProject(target);
    if (!button || !project) return;
    close();
    const action = button.dataset.menuAction;
    if (action === "open") actions.open(project.meta.id);
    else if (action === "rename") actions.rename(project.meta.id);
    else if (action === "duplicate") actions.duplicate(project);
    else if (action === "delete") actions.remove(project);
  });
  const onScroll = () => close();
  window.addEventListener("scroll", onScroll, true);
  stopMenu = () => {
    close();
    menu.remove();
    window.removeEventListener("scroll", onScroll, true);
  };
}

/** Draws missing thumbnails one at a time, the cards on screen first. */
function paintThumbs(section: HTMLElement, index: ConferenceIndex, tone: PresentationTone): void {
  const job = ++thumbJob;
  const cards = [...section.querySelectorAll<HTMLElement>(".project-card")].filter((item) => !item.querySelector("img[src]"));
  if (!cards.length) return;
  const visible = (item: HTMLElement) => {
    const rect = item.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  };
  const queue = [...cards.filter(visible), ...cards.filter((item) => !visible(item))];
  void (async () => {
    for (const item of queue) {
      if (job !== thumbJob) return;
      const project = findProject(item.dataset.project ?? "");
      if (!project) continue;
      const url = await projectThumb(project, projectDeck(project, tone), index).catch(() => null);
      if (job !== thumbJob || !url || !item.isConnected) continue;
      const image = item.querySelector<HTMLImageElement>(".project-card__thumb img");
      if (image) image.src = url;
    }
  })();
}
