/**
 * Motions tab: presets on the left, the 1:1 preview in the middle, the controllers on the right.
 * Typing, sliders, and image slots change the preview in place; only a sub-tab or preset change goes through the address.
 */
import type { ConferenceIndex } from "../shared/conference.ts";
import { escapeHtml } from "../lib/dom.ts";
import { confirmProceed, showToast } from "../feedback.ts";
import { hrefFor } from "../router.ts";
import { kit } from "../motions/kit.ts";
import { findMotionPreset, motionPresetsOf } from "../motions/index.ts";
import { motionCode } from "../motions/code-export.ts";
import {
  MOTION_DEFAULT_TEXT,
  MOTION_KINDS,
  MOTION_KIND_LABEL,
  MOTION_OUTPUTS,
  MOTION_SLOTS,
  MOTION_TEXT_MAX,
  carryStrong,
  changedMotionValues,
  defaultMotionValues,
  defaultSentence,
  factoryMotionValues,
  motionDefaults,
  motionGroups,
  motionStrong,
  motionText,
  motionWords,
  paramShown,
  type MotionDefaults,
  type MotionKind,
  type MotionOutput,
  type MotionParam,
  type MotionPrepared,
  type MotionPreset,
  type MotionValue,
  type MotionValues,
} from "../shared/motions.ts";
import { clearMotionsMemory, presetValues, readMotionsMemory, savePresetValues, writeMotionsMemory, type MotionBackdrop } from "../motions-store.ts";
import { saveMotionDefaults } from "../motion-defaults.ts";
import { getMotionClip, motionClipLabel, setMotionClip } from "../motion-clip.ts";
import {
  addMotionFile,
  conferenceAssets,
  defaultMotionSlots,
  libraryAssets,
  loadMotionFiles,
  motionCodeUrl,
  motionSlotImages,
  placeholderImage,
  projectAssets,
  releaseMotionFile,
  resolveMotionRef,
  type MotionAsset,
} from "../motion-assets.ts";
import { findProject, lastOpened, listProjects } from "../projects-store.ts";
import { encodeMotion, motionFontsReady, motionVideoSupported } from "./motion-render.ts";
import { noteMotionClip } from "./studio.ts";

type Mode = "light" | "dark";
export type MotionsView = { kind: MotionKind; presetId: string; mode: Mode; conference: ConferenceIndex };

type Live = {
  view: MotionsView;
  preset: MotionPreset;
  values: MotionValues;
  text: string;
  /** The sentence's 강조 단어 (word indexes). */
  strong: number[];
  refs: (string | null)[];
  images: CanvasImageSource[];
  prepared: MotionPrepared;
  ctx: CanvasRenderingContext2D;
  surfaces: Map<string, HTMLCanvasElement>;
  realT: number;
  playing: boolean;
  dirty: boolean;
  last: number;
  raf: number;
  scrubbing: boolean;
  timers: number[];
  hovers: Map<string, number>;
  observer: ResizeObserver | null;
  closePicker: (() => void) | null;
};

let live: Live | null = null;
/** The preset list's scroll, kept across the re-render a preset change makes. */
let listScroll: { kind: MotionKind; top: number } | null = null;
/** The video being made. It outlives the view, so leaving the tab does not stop it. */
let job: { cancel: { on: boolean }; percent: number } | null = null;

const ICON = {
  play: `<svg class="studio__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>`,
  pause: `<svg class="studio__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14"/><path d="M16 5v14"/></svg>`,
  restart: `<svg class="studio__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14"/><path d="M18 6 10 12l8 6z"/></svg>`,
  loop: `<svg class="studio__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a6 6 0 0 1 6-6h8"/><path d="m15 3 3 3-3 3"/><path d="M20 12a6 6 0 0 1-6 6H6"/><path d="m9 21-3-3 3-3"/></svg>`,
  close: `<svg class="studio__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6 6 18"/></svg>`,
};

const BACKDROPS: { id: MotionBackdrop; label: string }[] = [
  { id: "checker", label: "체커" },
  { id: "dark", label: "다크" },
  { id: "light", label: "라이트" },
];

/** Design-system colors offered beside every color field, read from tokens.css for the current mode. */
const TOKENS = ["--primary", "--soft", "--mid", "--deep", "--tint", "--accent", "--mute", "--warning", "--bg", "--fg"];

function tokenColors(): string[] {
  const style = getComputedStyle(document.documentElement);
  const probe = document.createElement("canvas").getContext("2d");
  return [
    ...new Set(
      TOKENS.flatMap((name) => {
        const value = style.getPropertyValue(name).trim();
        if (!probe || !value) return [];
        probe.fillStyle = "#000000";
        probe.fillStyle = value;
        const hex = String(probe.fillStyle);
        return /^#[0-9a-f]{6}$/i.test(hex) ? [hex.toUpperCase()] : [];
      }),
    ),
  ];
}

function backdropOf(mode: Mode): MotionBackdrop {
  return readMotionsMemory().backdrop ?? (mode === "light" ? "light" : "dark");
}

/** Montserrat and Roboto have no Hangul, so a Korean sentence is drawn in the system font unless Pretendard is picked. */
function fontHintShown(text: string, values: MotionValues): boolean {
  return /[\u3131-\u318E\uAC00-\uD7A3]/.test(text) && values.font !== "pretendard";
}

function format(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/** The filled part of a slider track, as the editor paints it. */
function paintFill(range: HTMLInputElement): void {
  const min = Number(range.min);
  const max = Number(range.max);
  const pct = max > min ? ((Number(range.value) - min) / (max - min)) * 100 : 0;
  range.style.setProperty("--range-fill", `${Math.min(100, Math.max(0, pct))}%`);
}

/** One controller, built from its schema with the editor's own field, slider, and swatch classes. */
function paramField(param: MotionParam, values: MotionValues, swatches: string[]): string {
  const id = `motion-param-${param.id}`;
  const hidden = paramShown(param, values) ? "" : " hidden";
  const label = escapeHtml(param.label);
  if (param.type === "range") {
    const value = format(Number(values[param.id]));
    const unit = param.unit ? ` <span class="motion-field__unit">${escapeHtml(param.unit)}</span>` : "";
    const step = format(param.step);
    return `
      <div class="studio__field motion-field" data-param="${param.id}"${hidden}>
        <label for="${id}">${label}${unit}</label>
        <div class="studio__radius">
          <input type="range" id="${id}" data-param-range="${param.id}" min="${param.min}" max="${param.max}" step="${param.step}" value="${value}" />
          <span class="studio__steps">
            <button type="button" class="studio__step" data-param-step="${param.id}" data-dir="-1" aria-label="${label} 줄이기" title="${step} 줄이기 · Shift ×10">−</button>
            <button type="button" class="studio__step" data-param-step="${param.id}" data-dir="1" aria-label="${label} 키우기" title="${step} 키우기 · Shift ×10">+</button>
          </span>
          <input type="number" class="studio__control studio__control--number" data-param-number="${param.id}" min="${param.min}" max="${param.max}" step="${param.step}" value="${value}" aria-label="${label} 수치" />
        </div>
      </div>`;
  }
  if (param.type === "select") {
    const options = param.options
      .map((option) => `<option value="${escapeHtml(option.value)}"${option.value === values[param.id] ? " selected" : ""}>${escapeHtml(option.label)}</option>`)
      .join("");
    return `
      <div class="studio__field motion-field" data-param="${param.id}"${hidden}>
        <label for="${id}">${label}</label>
        <select id="${id}" class="studio__control" data-param-select="${param.id}">${options}</select>
      </div>`;
  }
  if (param.type === "color") {
    const value = escapeHtml(String(values[param.id]));
    const chips = swatches
      .map((hex) => `<button type="button" class="studio__palette-swatch" data-param-swatch="${param.id}" data-color="${hex}" style="background:${hex}" aria-label="${label} ${hex}" title="${hex}"></button>`)
      .join("");
    return `
      <div class="studio__field motion-field" data-param="${param.id}"${hidden}>
        <label for="${id}">${label}</label>
        <div class="studio__color">
          <input type="color" id="${id}" class="studio__color-picker studio__color-picker--text" data-param-color="${param.id}" value="${value.toLowerCase()}" />
          <input type="text" class="studio__control" data-param-hex="${param.id}" value="${value}" maxlength="7" spellcheck="false" aria-label="${label} hex" />
        </div>
        <div class="studio__palette">${chips}</div>
      </div>`;
  }
  const on = values[param.id] === true;
  return `
    <div class="studio__field motion-field motion-field--toggle" data-param="${param.id}"${hidden}>
      <span id="${id}-label">${label}</span>
      <button type="button" class="motion-switch" id="${id}" role="switch" aria-checked="${on}" aria-labelledby="${id}-label" data-param-toggle="${param.id}"><span class="motion-switch__knob"></span></button>
    </div>`;
}

/** The sentence's words as toggles: a pressed word is a 강조 단어. */
function wordsHtml(text: string, strong: readonly number[]): string {
  return motionWords(text)
    .map((word, at) => `<button type="button" class="motion-word" data-word="${at}" aria-pressed="${strong.includes(at)}">${escapeHtml(word)}</button>`)
    .join("");
}

function usedSlots(preset: MotionPreset, values: MotionValues, refs: readonly (string | null)[]): Set<number> {
  const count = kit.slotCount(preset, values);
  const filled = refs.flatMap((ref, at) => (ref ? [at] : []));
  return new Set(filled.slice(0, count));
}

function slotsHtml(refs: readonly (string | null)[], used: Set<number>, conference: ConferenceIndex): string {
  return refs
    .map((ref, at) => {
      const asset = resolveMotionRef(ref, conference);
      const label = asset ? asset.label : ref ? "찾을 수 없음" : "비어 있음";
      return `
        <div class="motion-slot" data-slot="${at}" data-used="${used.has(at)}" draggable="${ref ? "true" : "false"}">
          <button type="button" class="motion-slot__pick" data-slot-pick="${at}" aria-label="슬롯 ${at + 1}: ${escapeHtml(label)}. 눌러서 바꾸기" title="${escapeHtml(label)}">
            ${asset ? `<img src="${escapeHtml(asset.thumb)}" alt="" draggable="false" />` : `<span class="motion-slot__empty" aria-hidden="true">+</span>`}
            <span class="motion-slot__no" aria-hidden="true">${at + 1}</span>
          </button>
          ${ref ? `<button type="button" class="motion-slot__clear" data-slot-clear="${at}" aria-label="슬롯 ${at + 1} 비우기" title="비우기">×</button>` : ""}
        </div>`;
    })
    .join("");
}

function slotRefs(): (string | null)[] {
  return readMotionsMemory().slots ?? defaultMotionSlots();
}

export function renderMotions(view: MotionsView): string {
  const memory = readMotionsMemory();
  const preset = findMotionPreset(view.presetId) ?? motionPresetsOf(view.kind)[0]!;
  const values = presetValues(preset, view.mode);
  const swatches = tokenColors();
  const tabs = MOTION_KINDS.map(
    (kind) =>
      `<a class="chip motions__tab" href="${hrefFor({ name: "motions", kind, preset: memory.last[kind] ?? null })}"${kind === preset.kind ? ' aria-current="page"' : ""}>${MOTION_KIND_LABEL[kind]}</a>`,
  ).join("");
  const cards = motionPresetsOf(preset.kind)
    .map(
      (item) => `
        <a class="motion-card" href="${hrefFor({ name: "motions", kind: item.kind, preset: item.id })}" data-motion-card="${item.id}"${item.id === preset.id ? ' aria-current="true"' : ""} title="${escapeHtml(item.summary)}">
          <canvas class="motion-card__thumb" width="240" height="240" data-thumb="${item.id}" aria-hidden="true"></canvas>
          <span class="motion-card__name">${escapeHtml(item.name)}</span>
        </a>`,
    )
    .join("");
  const groups = motionGroups(preset)
    .map(
      (group) => `
        <section class="motion-group" aria-label="${escapeHtml(group.title)}">
          <h3 class="motion-group__title">${escapeHtml(group.title)}</h3>
          ${group.params.map((param) => paramField(param, values, swatches)).join("")}
        </section>`,
    )
    .join("");
  const refs = slotRefs();
  const text = motionText(memory.text);
  const lead =
    preset.kind === "typography"
      ? `
        <div class="studio__field motion-field motion-field--text">
          <label for="motion-text">문장</label>
          <input type="text" id="motion-text" class="studio__control" maxlength="${MOTION_TEXT_MAX}" value="${escapeHtml(memory.text)}" placeholder="${escapeHtml(defaultSentence())}" spellcheck="false" autocomplete="off" />
          <p class="motion-field__hint">타이핑하는 대로 프리뷰에 반영됩니다. 비워 두면 기본 문장을 씁니다.</p>
          <p class="motion-field__hint" id="motion-font-hint"${fontHintShown(text, values) ? "" : " hidden"}>한글이 있으면 글꼴은 Pretendard를 권장합니다. Montserrat·Roboto에는 한글이 없어 시스템 글꼴로 그립니다.</p>
        </div>
        <div class="studio__field motion-field motion-field--words">
          <span id="motion-words-label">강조 단어</span>
          <div class="motion-words" id="motion-words" role="group" aria-labelledby="motion-words-label">${wordsHtml(text, motionStrong(text, memory.strong))}</div>
          <p class="motion-field__hint">누른 단어는 강조 굵기로, 나머지는 기본 굵기로 그립니다.</p>
        </div>`
      : `
        <div class="studio__field motion-field motion-field--slots">
          <span>이미지 슬롯</span>
          <div class="motion-slots" id="motion-slots">${slotsHtml(refs, usedSlots(preset, values, refs), view.conference)}</div>
          <p class="motion-field__hint">칸을 눌러 에셋이나 내 파일로 바꿉니다. 끌어서 순서를 바꾸고, 파일을 칸에 끌어 놓아도 됩니다. 밝은 칸을 이 프리셋이 씁니다.</p>
          <input type="file" id="motion-file" accept="image/*" hidden />
        </div>`;
  const backdrop = backdropOf(view.mode);
  const backdropButtons = BACKDROPS.map(
    (item) => `<button type="button" class="chip" data-backdrop="${item.id}" aria-pressed="${item.id === backdrop}">${item.label}</button>`,
  ).join("");
  const outputs = MOTION_OUTPUTS.map((size) => `<option value="${size}"${size === memory.output ? " selected" : ""}>${size} × ${size}</option>`).join("");
  return `
    <section class="motions" data-kind="${preset.kind}" data-backdrop="${backdrop}" aria-label="Motions">
      <div class="motions__bar">
        <nav class="motions__tabs" aria-label="모션 종류">${tabs}</nav>
        <p class="motions__clip" id="motion-clip">${escapeHtml(motionClipLabel(getMotionClip()))}</p>
      </div>
      <div class="motions__body">
        <nav class="motions__list" aria-label="${MOTION_KIND_LABEL[preset.kind]} 프리셋">${cards}</nav>
        <div class="motions__stage">
          <div class="motions__heading">
            <h1 class="motions__title">${escapeHtml(preset.name)}</h1>
            <p class="motions__summary">${escapeHtml(preset.summary)}</p>
          </div>
          <div class="motions__frame">
            <div class="motions__preview" id="motion-preview">
              <canvas id="motion-canvas" width="1080" height="1080" role="img" aria-label="${escapeHtml(preset.name)} 프리뷰"></canvas>
            </div>
          </div>
          <div class="motions__transport">
            <button type="button" class="studio__zoom-btn" id="motion-play" aria-label="일시정지" title="일시정지">${ICON.pause}</button>
            <button type="button" class="studio__zoom-btn" id="motion-restart" aria-label="처음부터" title="처음부터">${ICON.restart}</button>
            <div class="studio__radius motions__seek"><input type="range" id="motion-progress" min="0" max="1000" step="1" value="0" aria-label="재생 위치" /></div>
            <span class="motions__time" id="motion-time">0.0 / 0.0초</span>
            <button type="button" class="studio__zoom-btn" id="motion-loop" aria-pressed="${values.loop !== false}" aria-label="반복" title="반복">${ICON.loop}</button>
          </div>
          <div class="motions__options">
            <div class="motions__chips" role="group" aria-label="프리뷰 바탕">${backdropButtons}</div>
            <label class="motions__output">출력 <select class="studio__control" id="motion-output">${outputs}</select></label>
          </div>
          <div class="motions__export">
            <button type="button" class="button" id="motion-copy-video">${job ? `취소 ${Math.round(job.percent * 100)}%` : "영상 복사"}</button>
            <button type="button" class="button button--secondary" id="motion-copy-code">코드 복사</button>
          </div>
          <p class="motions__status" id="motion-status" role="status" aria-live="polite"></p>
        </div>
        <div class="motions__controls" id="motion-controls" role="region" aria-label="컨트롤러">
          ${lead}
          ${groups}
          <div class="motions__defaults">
            <button type="button" class="button button--secondary" id="motion-reset">기본값으로</button>
            <button type="button" class="button button--secondary" id="motion-set-default">이 값을 기본값으로 설정</button>
            <button type="button" class="button button--secondary" id="motion-reset-all">완전 리셋</button>
          </div>
        </div>
      </div>
    </section>`;
}

/** Stops the preview, the hovered thumbnails, and an open picker. A video being made keeps going. */
export function releaseMotions(): void {
  if (!live) return;
  const list = document.querySelector<HTMLElement>(".motions__list");
  if (list) listScroll = { kind: live.preset.kind, top: list.scrollTop };
  cancelAnimationFrame(live.raf);
  for (const raf of live.hovers.values()) cancelAnimationFrame(raf);
  for (const timer of live.timers) window.clearTimeout(timer);
  live.observer?.disconnect();
  live.closePicker?.();
  live = null;
}

function syncJobButton(): void {
  const button = document.querySelector<HTMLButtonElement>("#motion-copy-video");
  if (button) button.textContent = job ? `취소 ${Math.round(job.percent * 100)}%` : "영상 복사";
}

export function bindMotions(root: HTMLElement, view: MotionsView, onChange: () => void): void {
  releaseMotions();
  const section = root.querySelector<HTMLElement>(".motions");
  const canvas = root.querySelector<HTMLCanvasElement>("#motion-canvas");
  const ctx = canvas?.getContext("2d");
  if (!section || !canvas || !ctx) return;
  const preset = findMotionPreset(view.presetId) ?? motionPresetsOf(view.kind)[0]!;
  const memory = readMotionsMemory();
  writeMotionsMemory((stored) => {
    stored.kind = preset.kind;
    stored.last[preset.kind] = preset.id;
  });
  const values = presetValues(preset, view.mode);
  const text = motionText(memory.text);
  const strong = motionStrong(text, memory.strong);
  const refs = slotRefs();
  const placeholders = [0, 1, 2].map((at) => placeholderImage(at));
  const state: Live = {
    view,
    preset,
    values,
    text,
    strong,
    refs,
    images: preset.kind === "image" ? placeholders : [],
    prepared: kit.prepare(preset, values, text, preset.kind === "image" ? placeholders : [], strong),
    ctx,
    surfaces: new Map(),
    realT: 0,
    playing: true,
    dirty: true,
    last: performance.now(),
    raf: 0,
    scrubbing: false,
    timers: [],
    hovers: new Map(),
    observer: null,
    closePicker: null,
  };
  live = state;
  const $ = <T extends Element>(selector: string) => section.querySelector<T>(selector);
  const list = $<HTMLElement>(".motions__list");
  if (list && listScroll?.kind === preset.kind) list.scrollTop = listScroll.top;
  const status = (message: string) => {
    const node = $<HTMLElement>("#motion-status");
    if (node) node.textContent = message;
  };

  /* ---------- preview ---------- */
  const progress = $<HTMLInputElement>("#motion-progress");
  const time = $<HTMLElement>("#motion-time");
  const playButton = $<HTMLButtonElement>("#motion-play");
  const syncPlay = () => {
    if (!playButton) return;
    const label = state.playing ? "일시정지" : "재생";
    playButton.innerHTML = state.playing ? ICON.pause : ICON.play;
    playButton.setAttribute("aria-label", label);
    playButton.title = label;
  };
  const syncProgress = () => {
    const total = state.prepared.timeline.total;
    if (progress && !state.scrubbing) {
      progress.value = String(Math.round((state.realT / Math.max(0.001, total)) * 1000));
      paintFill(progress);
    }
    if (time) time.textContent = `${state.realT.toFixed(1)} / ${total.toFixed(1)}초`;
  };
  const prepare = () => {
    state.prepared = kit.prepare(state.preset, state.values, state.text, state.images, state.strong);
    state.realT = Math.min(state.realT, state.prepared.timeline.total);
    state.dirty = true;
  };
  const frame = (now: number) => {
    if (live !== state) return;
    if (state.playing) {
      state.realT += Math.min(0.1, (now - state.last) / 1000);
      const total = state.prepared.timeline.total;
      if (state.realT >= total) {
        if (state.values.loop !== false) state.realT %= Math.max(0.001, total);
        else {
          state.realT = total;
          state.playing = false;
          syncPlay();
        }
      }
      state.dirty = true;
    }
    state.last = now;
    if (state.dirty) {
      kit.renderFrame(state.ctx, state.preset, state.values, state.prepared, state.realT, state.surfaces);
      state.dirty = false;
      syncProgress();
    }
    state.raf = requestAnimationFrame(frame);
  };
  const preview = $<HTMLElement>("#motion-preview");
  if (preview && typeof ResizeObserver !== "undefined") {
    state.observer = new ResizeObserver(() => {
      const size = Math.max(120, Math.min(1080, Math.round(preview.getBoundingClientRect().width * (window.devicePixelRatio || 1))));
      if (canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
        state.dirty = true;
      }
    });
    state.observer.observe(preview);
  }
  state.raf = requestAnimationFrame(frame);
  playButton?.addEventListener("click", () => {
    if (!state.playing && state.realT >= state.prepared.timeline.total) state.realT = 0;
    state.playing = !state.playing;
    state.last = performance.now();
    syncPlay();
  });
  $("#motion-restart")?.addEventListener("click", () => {
    state.realT = 0;
    state.playing = true;
    state.last = performance.now();
    state.dirty = true;
    syncPlay();
  });
  progress?.addEventListener("pointerdown", () => {
    state.scrubbing = true;
  });
  progress?.addEventListener("input", () => {
    state.playing = false;
    syncPlay();
    state.realT = (Number(progress.value) / 1000) * state.prepared.timeline.total;
    paintFill(progress);
    state.dirty = true;
  });
  progress?.addEventListener("change", () => {
    state.scrubbing = false;
  });

  /* ---------- list thumbnails ---------- */
  const thumbSurfaces = new Map<string, Map<string, HTMLCanvasElement>>();
  /** A card's thumbnail, set up with the sentence and pictures as they are now. */
  const thumbOf = (id: string) => {
    const item = findMotionPreset(id);
    const g = section.querySelector<HTMLCanvasElement>(`[data-thumb="${id}"]`)?.getContext("2d");
    if (!item || !g) return null;
    const values = item.id === state.preset.id ? state.values : presetValues(item, view.mode);
    let surfaces = thumbSurfaces.get(id);
    if (!surfaces) {
      surfaces = new Map();
      thumbSurfaces.set(id, surfaces);
    }
    return { item, g, values, surfaces, prepared: kit.prepare(item, values, state.text, state.images, state.strong) };
  };
  const drawThumb = (id: string) => {
    const thumb = thumbOf(id);
    if (thumb) kit.renderFrame(thumb.g, thumb.item, thumb.values, thumb.prepared, kit.thumbTime(thumb.prepared.timeline, thumb.item.posterAt), thumb.surfaces);
  };
  const drawThumbs = () => {
    for (const item of motionPresetsOf(state.preset.kind)) if (!state.hovers.has(item.id)) drawThumb(item.id);
  };
  /** Each typography card has its own font and weight: draw the cards once those have the sentence's letters. */
  const drawThumbsWhenReady = () => {
    const items = state.preset.kind === "typography" ? motionPresetsOf("typography") : [];
    const fonts = items.map((item) => motionFontsReady(item.id === state.preset.id ? state.values : presetValues(item, view.mode), state.text));
    void Promise.all(fonts).then(() => {
      if (live === state) drawThumbs();
    });
  };
  section.querySelectorAll<HTMLElement>("[data-motion-card]").forEach((card) => {
    const id = card.dataset.motionCard ?? "";
    card.addEventListener("pointerenter", () => {
      const thumb = state.hovers.has(id) || live !== state ? null : thumbOf(id);
      if (!thumb) return;
      const start = performance.now();
      const loop = (now: number) => {
        if (live !== state || !state.hovers.has(id)) return;
        // Each pass of the motion, over and over, while the pointer stays.
        const realT = ((now - start) / 1000) % Math.max(0.001, thumb.prepared.timeline.total);
        kit.renderFrame(thumb.g, thumb.item, thumb.values, thumb.prepared, realT, thumb.surfaces);
        state.hovers.set(id, requestAnimationFrame(loop));
      };
      state.hovers.set(id, requestAnimationFrame(loop));
    });
    card.addEventListener("pointerleave", () => {
      const raf = state.hovers.get(id);
      if (raf !== undefined) cancelAnimationFrame(raf);
      state.hovers.delete(id);
      drawThumb(id);
    });
  });
  let thumbTimer = 0;
  const refreshThumbs = (delay = 400) => {
    window.clearTimeout(thumbTimer);
    thumbTimer = window.setTimeout(drawThumbsWhenReady, delay);
    state.timers.push(thumbTimer);
  };
  drawThumbs();

  /* ---------- controllers ---------- */
  const shown = () => {
    for (const group of motionGroups(state.preset)) {
      for (const param of group.params) {
        const field = section.querySelector<HTMLElement>(`[data-param="${param.id}"]`);
        if (field) field.hidden = !paramShown(param, state.values);
      }
    }
  };
  const syncSlotsUsed = () => {
    const used = usedSlots(state.preset, state.values, state.refs);
    section.querySelectorAll<HTMLElement>("[data-slot]").forEach((slot) => {
      slot.dataset.used = String(used.has(Number(slot.dataset.slot)));
    });
  };
  const syncFontHint = () => {
    const hint = $<HTMLElement>("#motion-font-hint");
    if (hint) hint.hidden = !fontHintShown(state.text, state.values);
  };
  const apply = (id: string, value: MotionValue) => {
    state.values[id] = value;
    savePresetValues(state.preset, state.values, view.mode);
    shown();
    if (id === "font") syncFontHint();
    if (id === "loop") $("#motion-loop")?.setAttribute("aria-pressed", String(value !== false));
    if (state.preset.kind === "image") syncSlotsUsed();
    prepare();
    if (["font", "weight"].includes(id)) {
      void motionFontsReady(state.values, state.text).then(() => {
        if (live === state) prepare();
      });
    }
    refreshThumbs();
  };
  const params = new Map(motionGroups(preset).flatMap((group) => group.params.map((param) => [param.id, param] as const)));
  const snap = (param: Extract<MotionParam, { type: "range" }>, value: number) => {
    const clamped = Math.min(param.max, Math.max(param.min, value));
    return Number((param.min + Math.round((clamped - param.min) / param.step) * param.step).toFixed(6));
  };
  const setRange = (id: string, value: number) => {
    const range = section.querySelector<HTMLInputElement>(`[data-param-range="${id}"]`);
    const number = section.querySelector<HTMLInputElement>(`[data-param-number="${id}"]`);
    if (range) {
      range.value = format(value);
      paintFill(range);
    }
    if (number) number.value = format(value);
    apply(id, value);
  };
  section.querySelectorAll<HTMLInputElement>("[data-param-range]").forEach((input) => {
    paintFill(input);
    input.addEventListener("input", () => setRange(input.dataset.paramRange ?? "", Number(input.value)));
  });
  section.querySelectorAll<HTMLInputElement>("[data-param-number]").forEach((input) => {
    const id = input.dataset.paramNumber ?? "";
    const param = params.get(id);
    input.addEventListener("change", () => {
      if (param?.type !== "range") return;
      setRange(id, Number.isFinite(Number(input.value)) && input.value.trim() !== "" ? snap(param, Number(input.value)) : param.default);
    });
  });
  section.querySelectorAll<HTMLButtonElement>("[data-param-step]").forEach((button) => {
    const id = button.dataset.paramStep ?? "";
    const param = params.get(id);
    button.addEventListener("click", (event) => {
      if (param?.type !== "range") return;
      setRange(id, snap(param, Number(state.values[id]) + Number(button.dataset.dir) * param.step * (event.shiftKey ? 10 : 1)));
    });
  });
  section.querySelectorAll<HTMLSelectElement>("[data-param-select]").forEach((select) => {
    select.addEventListener("change", () => apply(select.dataset.paramSelect ?? "", select.value));
  });
  const setColor = (id: string, hex: string) => {
    const value = hex.toUpperCase();
    const picker = section.querySelector<HTMLInputElement>(`[data-param-color="${id}"]`);
    const field = section.querySelector<HTMLInputElement>(`[data-param-hex="${id}"]`);
    if (picker) picker.value = value.toLowerCase();
    if (field && document.activeElement !== field) field.value = value;
    apply(id, value);
  };
  section.querySelectorAll<HTMLInputElement>("[data-param-color]").forEach((picker) => {
    picker.addEventListener("input", () => setColor(picker.dataset.paramColor ?? "", picker.value));
  });
  section.querySelectorAll<HTMLInputElement>("[data-param-hex]").forEach((field) => {
    field.addEventListener("change", () => {
      const id = field.dataset.paramHex ?? "";
      const hex = field.value.trim().replace(/^([^#])/, "#$1");
      if (/^#[0-9a-f]{6}$/i.test(hex)) setColor(id, hex);
      field.value = String(state.values[id]);
    });
  });
  section.querySelectorAll<HTMLButtonElement>("[data-param-swatch]").forEach((chip) => {
    chip.addEventListener("click", () => setColor(chip.dataset.paramSwatch ?? "", chip.dataset.color ?? "#FFFFFF"));
  });
  section.querySelectorAll<HTMLButtonElement>("[data-param-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.getAttribute("aria-checked") !== "true";
      button.setAttribute("aria-checked", String(next));
      apply(button.dataset.paramToggle ?? "", next);
    });
  });
  $("#motion-loop")?.addEventListener("click", () => {
    const next = state.values.loop === false;
    section.querySelector<HTMLButtonElement>('[data-param-toggle="loop"]')?.setAttribute("aria-checked", String(next));
    if (next && !state.playing) {
      state.playing = true;
      state.realT = 0;
      syncPlay();
    }
    apply("loop", next);
  });
  $("#motion-reset")?.addEventListener("click", () => {
    savePresetValues(state.preset, defaultMotionValues(state.preset, view.mode), view.mode);
    onChange();
    showToast(`${state.preset.name}을 기본값으로 되돌렸습니다.`);
  });
  $("#motion-set-default")?.addEventListener("click", () => {
    void (async () => {
      const typography = state.preset.kind === "typography";
      const what = typography ? "지금 값과 문장·강조 단어를" : "지금 값과 이미지 슬롯을";
      if (!(await confirmProceed(`${state.preset.name}의 ${what} 기본값으로 설정하시겠습니까?`))) return;
      const current = motionDefaults();
      const next: MotionDefaults = { ...current, values: { ...current.values } };
      const own = changedMotionValues(state.values, factoryMotionValues(state.preset, view.mode));
      if (Object.keys(own).length) next.values[state.preset.id] = own;
      else delete next.values[state.preset.id];
      let skipped = false;
      if (typography) {
        if (state.text === MOTION_DEFAULT_TEXT) delete next.text;
        else next.text = state.text;
        next.strong = [...state.strong];
      } else {
        // A file of mine lives only in this browser, so it cannot be a default.
        next.slots = state.refs.map((ref) => {
          if (!ref?.startsWith("file:")) return ref;
          skipped = true;
          return null;
        });
      }
      if (!(await saveMotionDefaults(next))) {
        showToast("기본값을 저장하지 못했습니다. 로컬 개발 서버에서만 설정할 수 있습니다.");
        return;
      }
      // This browser keeps only what differs from the new defaults.
      savePresetValues(state.preset, state.values, view.mode);
      showToast(skipped ? "기본값으로 설정하였습니다. 내 파일 칸은 기본값에 넣지 않았습니다." : "기본값으로 설정하였습니다.");
    })();
  });
  $("#motion-reset-all")?.addEventListener("click", () => {
    void (async () => {
      const question = "Motions의 모든 프리셋 값과 문장·강조 단어·이미지 슬롯·출력 크기·바탕을 기본값으로 되돌리시겠습니까? 슬롯에 넣은 내 파일도 지웁니다.";
      if (!(await confirmProceed(question))) return;
      const files = (readMotionsMemory().slots ?? []).filter((ref): ref is string => !!ref?.startsWith("file:"));
      clearMotionsMemory();
      for (const ref of files) void releaseMotionFile(ref, []);
      onChange();
      showToast("Motions를 완전 리셋하였습니다.");
    })();
  });

  /* ---------- the sentence ---------- */
  const textInput = $<HTMLInputElement>("#motion-text");
  let textTimer = 0;
  const words = $<HTMLElement>("#motion-words");
  const renderWords = () => {
    if (words) words.innerHTML = wordsHtml(state.text, state.strong);
  };
  words?.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-word]") : null;
    if (!button) return;
    const at = Number(button.dataset.word);
    state.strong = state.strong.includes(at) ? state.strong.filter((item) => item !== at) : [...state.strong, at].sort((a, b) => a - b);
    writeMotionsMemory((stored) => {
      stored.strong = state.strong;
    });
    button.setAttribute("aria-pressed", String(state.strong.includes(at)));
    prepare();
    refreshThumbs();
  });
  textInput?.addEventListener("input", () => {
    const typed = textInput.value.trim() !== "";
    const next = motionText(textInput.value);
    state.strong = typed ? carryStrong(motionWords(state.text), state.strong, motionWords(next)) : motionStrong(next, null);
    state.text = next;
    writeMotionsMemory((stored) => {
      stored.text = textInput.value;
      stored.strong = typed ? state.strong : null;
    });
    renderWords();
    syncFontHint();
    prepare();
    void motionFontsReady(state.values, state.text).then(() => {
      if (live === state) prepare();
    });
    window.clearTimeout(textTimer);
    if (state.preset.timing === "intro") {
      textTimer = window.setTimeout(() => {
        if (live !== state) return;
        state.realT = 0;
        state.playing = true;
        state.last = performance.now();
        syncPlay();
      }, 500);
      state.timers.push(textTimer);
    }
    refreshThumbs(700);
  });

  /* ---------- backdrop and output ---------- */
  section.querySelectorAll<HTMLButtonElement>("[data-backdrop]").forEach((button) => {
    button.addEventListener("click", () => {
      const backdrop = (button.dataset.backdrop ?? "dark") as MotionBackdrop;
      section.dataset.backdrop = backdrop;
      section.querySelectorAll<HTMLButtonElement>("[data-backdrop]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      writeMotionsMemory((stored) => {
        stored.backdrop = backdrop;
      });
    });
  });
  const output = $<HTMLSelectElement>("#motion-output");
  output?.addEventListener("change", () => {
    const size = Number(output.value) as MotionOutput;
    writeMotionsMemory((stored) => {
      stored.output = MOTION_OUTPUTS.includes(size) ? size : 1080;
    });
  });

  /* ---------- 영상 복사 · 코드 복사 ---------- */
  $("#motion-copy-video")?.addEventListener("click", () => {
    if (job) {
      job.cancel.on = true;
      return;
    }
    void (async () => {
      const size = readMotionsMemory().output;
      const transparent = state.values.background !== "solid";
      if (!(await motionVideoSupported(size, transparent))) {
        showToast(transparent ? "이 브라우저는 투명 영상을 만들 수 없습니다. 배경을 단색으로 바꾸거나 Chrome에서 만드세요." : "이 브라우저는 영상을 만들 수 없습니다. Chrome에서 만드세요.");
        return;
      }
      const setup = { preset: state.preset, values: { ...state.values }, text: state.text, strong: [...state.strong], images: [...state.images] };
      const mine = { cancel: { on: false }, percent: 0 };
      job = mine;
      syncJobButton();
      status(`영상을 만드는 중입니다 · ${size} × ${size}`);
      try {
        const video = await encodeMotion(setup, size, (done) => {
          mine.percent = done;
          syncJobButton();
        }, mine.cancel);
        if (!video) {
          if (live === state) status("영상 만들기를 취소했습니다.");
          return;
        }
        setMotionClip({ ...video, presetId: setup.preset.id, name: setup.preset.name, size, loop: setup.values.loop !== false, transparent });
        noteMotionClip();
        const clip = document.querySelector("#motion-clip");
        if (clip) clip.textContent = motionClipLabel(getMotionClip());
        if (live === state) status(`${video.ext.toUpperCase()} ${video.seconds.toFixed(1)}초를 복사했습니다.`);
        showToast("영상을 복사했습니다. Presentation 편집 화면에서 ⌘V로 붙여 넣으세요.");
      } catch {
        showToast("영상을 만들지 못했습니다.");
        if (live === state) status("");
      } finally {
        job = null;
        syncJobButton();
      }
    })();
  });
  $("#motion-copy-code")?.addEventListener("click", () => {
    void (async () => {
      const urls =
        state.preset.kind === "image"
          ? (await Promise.all(state.refs.filter((ref): ref is string => !!ref).map((ref) => motionCodeUrl(ref, view.conference)))).filter((url): url is string => !!url)
          : [];
      const code = motionCode(state.preset, { ...state.values }, state.text, [...state.strong], urls, readMotionsMemory().output);
      if (code.length > 5_000_000 && !(await confirmProceed(`코드가 ${(code.length / 1_000_000).toFixed(1)}MB입니다. 내 파일 그림이 데이터로 들어 있습니다. 복사할까요?`))) return;
      try {
        await navigator.clipboard.writeText(code);
      } catch {
        const area = document.createElement("textarea");
        area.value = code;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.append(area);
        area.select();
        const copied = document.execCommand("copy");
        area.remove();
        if (!copied) {
          showToast("코드를 복사하지 못했습니다.");
          return;
        }
      }
      status(`코드 ${(code.length / 1000).toFixed(0)}KB를 복사했습니다.`);
      showToast("코드를 복사했습니다. HTML 파일에 붙여 넣으면 그대로 재생됩니다.");
    })();
  });

  /* ---------- image slots ---------- */
  const loadImages = async () => {
    await loadMotionFiles();
    const loaded = await motionSlotImages(state.refs, view.conference);
    if (live !== state) return;
    state.images = loaded.length ? loaded : placeholders;
    prepare();
    drawThumbs();
  };
  const saveRefs = (next: (string | null)[], released: (string | null)[] = []) => {
    state.refs = next;
    writeMotionsMemory((stored) => {
      stored.slots = next;
    });
    for (const ref of released) void releaseMotionFile(ref, next);
    renderSlots();
    void loadImages();
  };
  const fileInput = $<HTMLInputElement>("#motion-file");
  let fileTarget = 0;
  const putFile = async (file: File, at: number) => {
    const ref = await addMotionFile(file);
    if (!ref) {
      showToast("파일을 넣지 못했습니다.");
      return;
    }
    const next = [...state.refs];
    const old = next[at];
    next[at] = ref;
    saveRefs(next, [old]);
  };
  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (file) void putFile(file, fileTarget);
  });
  const openPicker = (at: number) => {
    state.closePicker?.();
    const projects = listProjects();
    let project = findProject(lastOpened()) ?? projects[0];
    let tab: "project" | "conference" | "library" = project ? "project" : "library";
    const backdrop = document.createElement("div");
    backdrop.className = "confirm-backdrop motion-picker__backdrop";
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const close = () => {
      document.removeEventListener("keydown", onKey);
      backdrop.remove();
      state.closePicker = null;
      previous?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    const assets = (): MotionAsset[] =>
      tab === "project" ? (project ? projectAssets(project, view.mode) : []) : tab === "conference" ? conferenceAssets(view.conference) : libraryAssets();
    const draw = () => {
      const list = assets();
      const projectSelect =
        tab === "project"
          ? `<label class="motion-picker__project">프로젝트 <select class="studio__control" data-picker-project>${projects
              .map((item) => `<option value="${escapeHtml(item.meta.id)}"${item === project ? " selected" : ""}>${escapeHtml(item.meta.title)}</option>`)
              .join("")}</select></label>`
          : "";
      const items = list.length
        ? list
            .map(
              (item) =>
                `<button type="button" class="motion-picker__item" data-pick-ref="${escapeHtml(item.ref)}" title="${escapeHtml(item.label)}"><img src="${escapeHtml(item.thumb)}" alt="" loading="lazy" /><span>${escapeHtml(item.label)}</span></button>`,
            )
            .join("")
        : `<p class="motion-picker__empty">${tab === "project" ? "이 프로젝트의 페이지에 그림이 없습니다." : "그림이 없습니다."}</p>`;
      backdrop.innerHTML = `
        <div class="confirm-dialog motion-picker" role="dialog" aria-modal="true" aria-labelledby="motion-picker-title">
          <div class="motion-picker__head">
            <h2 class="motion-picker__title" id="motion-picker-title">슬롯 ${at + 1} 이미지</h2>
            <button type="button" class="studio__zoom-btn" data-picker-close aria-label="닫기">${ICON.close}</button>
          </div>
          <div class="motions__chips" role="tablist" aria-label="에셋">
            <button type="button" class="chip" role="tab" data-picker-tab="project" aria-selected="${tab === "project"}" aria-pressed="${tab === "project"}">프로젝트</button>
            <button type="button" class="chip" role="tab" data-picker-tab="conference" aria-selected="${tab === "conference"}" aria-pressed="${tab === "conference"}">Conference</button>
            <button type="button" class="chip" role="tab" data-picker-tab="library" aria-selected="${tab === "library"}" aria-pressed="${tab === "library"}">그래픽 라이브러리</button>
          </div>
          ${projectSelect}
          <div class="motion-picker__grid">${items}</div>
          <div class="confirm-dialog__actions">
            <button type="button" class="button" data-picker-file>내 파일에서 고르기</button>
          </div>
        </div>`;
      backdrop.querySelector("[data-picker-close]")?.addEventListener("click", close);
      backdrop.querySelectorAll<HTMLButtonElement>("[data-picker-tab]").forEach((button) => {
        button.addEventListener("click", () => {
          tab = (button.dataset.pickerTab ?? "library") as typeof tab;
          draw();
          backdrop.querySelector<HTMLButtonElement>(`[data-picker-tab="${tab}"]`)?.focus();
        });
      });
      backdrop.querySelector<HTMLSelectElement>("[data-picker-project]")?.addEventListener("change", (event) => {
        project = findProject((event.target as HTMLSelectElement).value) ?? project;
        draw();
      });
      backdrop.querySelectorAll<HTMLButtonElement>("[data-pick-ref]").forEach((button) => {
        button.addEventListener("click", () => {
          const next = [...state.refs];
          const old = next[at];
          next[at] = button.dataset.pickRef ?? null;
          close();
          saveRefs(next, [old]);
        });
      });
      backdrop.querySelector("[data-picker-file]")?.addEventListener("click", () => {
        fileTarget = at;
        close();
        fileInput?.click();
      });
    };
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close();
    });
    document.addEventListener("keydown", onKey);
    draw();
    document.body.append(backdrop);
    backdrop.querySelector<HTMLButtonElement>(`[data-picker-tab="${tab}"]`)?.focus();
    state.closePicker = close;
  };
  const renderSlots = () => {
    const host = $<HTMLElement>("#motion-slots");
    if (!host) return;
    host.innerHTML = slotsHtml(state.refs, usedSlots(state.preset, state.values, state.refs), view.conference);
    bindSlots(host);
  };
  const bindSlots = (host: HTMLElement) => {
    host.querySelectorAll<HTMLButtonElement>("[data-slot-pick]").forEach((button) => {
      button.addEventListener("click", () => openPicker(Number(button.dataset.slotPick)));
    });
    host.querySelectorAll<HTMLButtonElement>("[data-slot-clear]").forEach((button) => {
      button.addEventListener("click", () => {
        const at = Number(button.dataset.slotClear);
        const next = [...state.refs];
        const old = next[at];
        next[at] = null;
        saveRefs(next, [old]);
      });
    });
    host.querySelectorAll<HTMLElement>("[data-slot]").forEach((slot) => {
      const at = Number(slot.dataset.slot);
      slot.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("text/x-motion-slot", String(at));
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      });
      slot.addEventListener("dragover", (event) => {
        const types = event.dataTransfer?.types ?? [];
        if (!types.includes("text/x-motion-slot") && !types.includes("Files")) return;
        event.preventDefault();
        slot.dataset.drop = "true";
      });
      slot.addEventListener("dragleave", () => {
        delete slot.dataset.drop;
      });
      slot.addEventListener("drop", (event) => {
        delete slot.dataset.drop;
        const file = [...(event.dataTransfer?.files ?? [])].find((item) => item.type.startsWith("image/"));
        if (file) {
          event.preventDefault();
          void putFile(file, at);
          return;
        }
        const from = Number(event.dataTransfer?.getData("text/x-motion-slot"));
        if (!Number.isInteger(from) || from === at || from < 0 || from >= MOTION_SLOTS) return;
        event.preventDefault();
        const next = [...state.refs];
        const [moved] = next.splice(from, 1);
        next.splice(at, 0, moved ?? null);
        saveRefs(next);
      });
    });
  };
  if (preset.kind === "image") {
    const host = $<HTMLElement>("#motion-slots");
    if (host) bindSlots(host);
    void loadImages();
  } else {
    void motionFontsReady(values, text).then(() => {
      if (live === state) prepare();
    });
    drawThumbsWhenReady();
  }
  syncPlay();
}
