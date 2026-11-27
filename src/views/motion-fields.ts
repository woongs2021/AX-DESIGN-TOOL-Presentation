/**
 * Motion controllers built from a preset's schema, with the editor's own field, slider (− + number), select, color
 * (picker, hex, design-token swatches), and switch styles. Shared by the Motions tab and the layer motion popup.
 */
import { escapeHtml } from "../lib/dom.ts";
import { paramShown, type MotionParam, type MotionValue, type MotionValues } from "../shared/motions.ts";

/** Design-system colors offered beside every color field, read from tokens.css for the current mode. */
const TOKENS = ["--primary", "--soft", "--mid", "--deep", "--tint", "--accent", "--mute", "--warning", "--bg", "--fg"];

export function tokenColors(): string[] {
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

export function format(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/** The filled part of a slider track, as the editor paints it. */
export function paintFill(range: HTMLInputElement): void {
  const min = Number(range.min);
  const max = Number(range.max);
  const pct = max > min ? ((Number(range.value) - min) / (max - min)) * 100 : 0;
  range.style.setProperty("--range-fill", `${Math.min(100, Math.max(0, pct))}%`);
}

/** One controller. `prefix` keeps element ids apart when two panels are on the page. */
export function paramField(param: MotionParam, values: MotionValues, swatches: string[], prefix = "motion-param"): string {
  const id = `${prefix}-${param.id}`;
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

function snap(param: Extract<MotionParam, { type: "range" }>, value: number): number {
  const clamped = Math.min(param.max, Math.max(param.min, value));
  return Number((param.min + Math.round((clamped - param.min) / param.step) * param.step).toFixed(6));
}

/**
 * Wires the fields `paramField` drew inside `root`. Every change goes through `apply(id, value)`, which updates `values`
 * (the caller's live object); then the fields that depend on another value show or hide.
 */
export function bindParamFields(
  root: ParentNode,
  params: readonly MotionParam[],
  values: MotionValues,
  apply: (id: string, value: MotionValue) => void,
): void {
  const byId = new Map(params.map((param) => [param.id, param] as const));
  const shown = () => {
    for (const param of params) {
      const field = root.querySelector<HTMLElement>(`[data-param="${param.id}"]`);
      if (field) field.hidden = !paramShown(param, values);
    }
  };
  const set = (id: string, value: MotionValue) => {
    apply(id, value);
    shown();
  };
  const setRange = (id: string, value: number) => {
    const range = root.querySelector<HTMLInputElement>(`[data-param-range="${id}"]`);
    const number = root.querySelector<HTMLInputElement>(`[data-param-number="${id}"]`);
    if (range) {
      range.value = format(value);
      paintFill(range);
    }
    if (number) number.value = format(value);
    set(id, value);
  };
  root.querySelectorAll<HTMLInputElement>("[data-param-range]").forEach((input) => {
    paintFill(input);
    input.addEventListener("input", () => setRange(input.dataset.paramRange ?? "", Number(input.value)));
  });
  root.querySelectorAll<HTMLInputElement>("[data-param-number]").forEach((input) => {
    const id = input.dataset.paramNumber ?? "";
    const param = byId.get(id);
    input.addEventListener("change", () => {
      if (param?.type !== "range") return;
      setRange(id, Number.isFinite(Number(input.value)) && input.value.trim() !== "" ? snap(param, Number(input.value)) : param.default);
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-param-step]").forEach((button) => {
    const id = button.dataset.paramStep ?? "";
    const param = byId.get(id);
    button.addEventListener("click", (event) => {
      if (param?.type !== "range") return;
      setRange(id, snap(param, Number(values[id]) + Number(button.dataset.dir) * param.step * (event.shiftKey ? 10 : 1)));
    });
  });
  root.querySelectorAll<HTMLSelectElement>("[data-param-select]").forEach((select) => {
    select.addEventListener("change", () => set(select.dataset.paramSelect ?? "", select.value));
  });
  const setColor = (id: string, hex: string) => {
    const value = hex.toUpperCase();
    const picker = root.querySelector<HTMLInputElement>(`[data-param-color="${id}"]`);
    const field = root.querySelector<HTMLInputElement>(`[data-param-hex="${id}"]`);
    if (picker) picker.value = value.toLowerCase();
    if (field && document.activeElement !== field) field.value = value;
    set(id, value);
  };
  root.querySelectorAll<HTMLInputElement>("[data-param-color]").forEach((picker) => {
    picker.addEventListener("input", () => setColor(picker.dataset.paramColor ?? "", picker.value));
  });
  root.querySelectorAll<HTMLInputElement>("[data-param-hex]").forEach((field) => {
    field.addEventListener("change", () => {
      const id = field.dataset.paramHex ?? "";
      const hex = field.value.trim().replace(/^([^#])/, "#$1");
      if (/^#[0-9a-f]{6}$/i.test(hex)) setColor(id, hex);
      field.value = String(values[id]);
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-param-swatch]").forEach((chip) => {
    chip.addEventListener("click", () => setColor(chip.dataset.paramSwatch ?? "", chip.dataset.color ?? "#FFFFFF"));
  });
  root.querySelectorAll<HTMLButtonElement>("[data-param-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.getAttribute("aria-checked") !== "true";
      button.setAttribute("aria-checked", String(next));
      set(button.dataset.paramToggle ?? "", next);
    });
  });
}
