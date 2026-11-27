/**
 * The layer motion popup in the Presentation editor: pick a Motions preset for the selected text or picture, watch it
 * on the layer itself, adjust 공통 and 이 효과, then 적용 (or 모션 없애기). The editor supplies the layer through
 * `setup`, so the preview shows exactly what plays on the slide.
 */
import { escapeHtml } from "../lib/dom.ts";
import { kit } from "../motions/kit.ts";
import { findMotionPreset, motionPresetsOf } from "../motions/index.ts";
import { layerMotionChanges, layerMotionParams, layerMotionStart, type MotionSquare } from "../motions/layer.ts";
import { normalizeMotionValues, type MotionKind, type MotionLayout, type MotionPreset, type MotionValue, type MotionValues } from "../shared/motions.ts";
import type { LayerMotion } from "../shared/studio.ts";
import { bindParamFields, paramField, tokenColors } from "./motion-fields.ts";

/** What a preset plays on the layer: the values with what the layer sets, the letters or pictures, and the square around it. */
export type LayerMotionSetup = { values: MotionValues; layout: MotionLayout | null; images: CanvasImageSource[]; square: MotionSquare; text: string };

export type LayerMotionSubject = {
  kind: MotionKind;
  title: string;
  setup(preset: MotionPreset, values: MotionValues): LayerMotionSetup | null;
};

const CLOSE = `<svg class="studio__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6 6 18"/></svg>`;
let closeOpen: (() => void) | null = null;

function drawOn(canvas: HTMLCanvasElement, preset: MotionPreset, setup: LayerMotionSetup, realT: number | null, surfaces: Map<string, HTMLCanvasElement>): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  const prepared = kit.prepare(preset, setup.values, setup.text, setup.images, [], setup.layout);
  const total = prepared.timeline.total;
  const at = realT === null ? kit.thumbTime(prepared.timeline, preset.posterAt) : realT % Math.max(0.001, total);
  kit.renderFrame(ctx, preset, setup.values, prepared, at, surfaces);
  return total;
}

export function closeLayerMotion(): void {
  closeOpen?.();
}

/** Opens the popup for one layer. onApply gets the chosen motion, or null for 모션 없애기. */
export function openLayerMotion(options: { subject: LayerMotionSubject; motion: LayerMotion | null; onApply: (motion: LayerMotion | null) => void }): void {
  closeOpen?.();
  const { subject } = options;
  const presets = motionPresetsOf(subject.kind);
  const stored = options.motion ? findMotionPreset(options.motion.preset) : undefined;
  let preset = stored?.kind === subject.kind ? stored : presets[0]!;
  const valuesOf = new Map<string, MotionValues>();
  const values = (item: MotionPreset): MotionValues => {
    let found = valuesOf.get(item.id);
    if (!found) {
      found = item === stored ? normalizeMotionValues(item, options.motion?.values, "dark", layerMotionStart(item)) : layerMotionStart(item);
      valuesOf.set(item.id, found);
    }
    return found;
  };
  const swatches = tokenColors();
  const backdrop = document.createElement("div");
  backdrop.className = "confirm-backdrop layer-motion__backdrop";
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const cards = presets
    .map(
      (item) => `
        <button type="button" class="layer-motion__card" data-layer-preset="${item.id}" aria-pressed="${item === preset}" title="${escapeHtml(item.summary)}">
          <canvas width="160" height="160" data-layer-thumb="${item.id}" aria-hidden="true"></canvas>
          <span>${escapeHtml(item.name)}</span>
        </button>`,
    )
    .join("");
  backdrop.innerHTML = `
    <div class="confirm-dialog layer-motion" role="dialog" aria-modal="true" aria-labelledby="layer-motion-title">
      <div class="layer-motion__head">
        <h2 class="layer-motion__title" id="layer-motion-title">${escapeHtml(subject.title)}</h2>
        <button type="button" class="studio__zoom-btn" data-layer-motion-close aria-label="닫기">${CLOSE}</button>
      </div>
      <div class="layer-motion__body">
        <div class="layer-motion__list" role="group" aria-label="모션 프리셋">${cards}</div>
        <div class="layer-motion__stage">
          <div class="layer-motion__preview"><canvas data-layer-preview role="img" aria-label="모션 미리보기"></canvas></div>
          <p class="layer-motion__summary" data-layer-summary></p>
        </div>
        <div class="layer-motion__controls" data-layer-controls></div>
      </div>
      <div class="layer-motion__foot">
        ${options.motion ? `<button type="button" class="button button--secondary" data-layer-motion-remove>모션 없애기</button>` : ""}
        <span class="layer-motion__spacer"></span>
        <button type="button" class="button button--secondary" data-layer-motion-close>취소</button>
        <button type="button" class="button" data-layer-motion-apply>적용</button>
      </div>
    </div>`;
  const preview = backdrop.querySelector<HTMLCanvasElement>("[data-layer-preview]")!;
  const summary = backdrop.querySelector<HTMLElement>("[data-layer-summary]")!;
  const controls = backdrop.querySelector<HTMLElement>("[data-layer-controls]")!;
  let surfaces = new Map<string, HTMLCanvasElement>();
  let setup = subject.setup(preset, values(preset));
  let start = performance.now();
  let raf = 0;
  const loop = (now: number) => {
    if (setup) drawOn(preview, preset, setup, (now - start) / 1000, surfaces);
    raf = requestAnimationFrame(loop);
  };
  const restart = () => {
    setup = subject.setup(preset, values(preset));
    start = performance.now();
    summary.textContent = setup ? preset.summary : "이 레이어는 아직 그릴 수 없습니다. 그림이 다 불러와지면 다시 열어 주세요.";
  };
  const thumb = (item: MotionPreset) => {
    const canvas = backdrop.querySelector<HTMLCanvasElement>(`[data-layer-thumb="${item.id}"]`);
    const itemSetup = canvas ? subject.setup(item, values(item)) : null;
    if (canvas && itemSetup) drawOn(canvas, item, itemSetup, null, new Map());
  };
  const showControls = () => {
    const params = layerMotionParams(preset);
    const live = values(preset);
    controls.innerHTML = `<h3 class="motion-group__title">${escapeHtml(preset.name)}</h3>${params.map((param) => paramField(param, live, swatches, "layer-motion")).join("")}`;
    bindParamFields(controls, params, live, (id: string, value: MotionValue) => {
      live[id] = value;
      restart();
      thumb(preset);
    });
  };
  const pick = (item: MotionPreset) => {
    preset = item;
    surfaces = new Map();
    backdrop.querySelectorAll<HTMLButtonElement>("[data-layer-preset]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.layerPreset === item.id)));
    showControls();
    restart();
  };
  const close = () => {
    cancelAnimationFrame(raf);
    document.removeEventListener("keydown", onKey);
    backdrop.remove();
    closeOpen = null;
    previous?.focus();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };
  backdrop.querySelectorAll<HTMLButtonElement>("[data-layer-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = findMotionPreset(button.dataset.layerPreset ?? "");
      if (item) pick(item);
    });
  });
  backdrop.querySelectorAll("[data-layer-motion-close]").forEach((button) => button.addEventListener("click", close));
  backdrop.addEventListener("pointerdown", (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.querySelector("[data-layer-motion-remove]")?.addEventListener("click", () => {
    close();
    options.onApply(null);
  });
  backdrop.querySelector("[data-layer-motion-apply]")?.addEventListener("click", () => {
    const chosen = { preset: preset.id, values: layerMotionChanges(preset, values(preset)) };
    close();
    options.onApply(chosen);
  });
  document.addEventListener("keydown", onKey);
  document.body.append(backdrop);
  const side = Math.round(Math.min(1080, preview.getBoundingClientRect().width * (window.devicePixelRatio || 1))) || 720;
  preview.width = side;
  preview.height = side;
  showControls();
  restart();
  for (const item of presets) thumb(item);
  raf = requestAnimationFrame(loop);
  closeOpen = close;
  backdrop.querySelector<HTMLButtonElement>(`[data-layer-preset="${preset.id}"]`)?.focus();
}
