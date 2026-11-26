/**
 * Motions (Dev Phase 3): the preset model, its controller schema, stored values, and the names of pasted motion videos.
 * Pure: no DOM. The drawing helpers live in src/motions/kit.ts.
 */
import type { MotionKit } from "../motions/kit.ts";

export type MotionKind = "typography" | "image";
export const MOTION_KINDS: readonly MotionKind[] = ["typography", "image"];
export const MOTION_KIND_LABEL: Record<MotionKind, string> = { typography: "타이포그래피", image: "이미지" };

/** Every motion is drawn in a square of this many units; a 2160 output draws the same units twice as large. */
export const MOTION_SIZE = 1080;
export const MOTION_FPS = 30;
export const MOTION_MAX_SECONDS = 20;
export const MOTION_DEFAULT_TEXT = "AX gives people room to grow";
/** The default sentence's 강조 단어 (word indexes): AX, people, grow are bold, the rest thin. */
export const MOTION_DEFAULT_STRONG: readonly number[] = [0, 2, 5];
export const MOTION_TEXT_MAX = 120;
export const MOTION_SLOTS = 8;
export const MOTION_OUTPUTS = [1080, 2160] as const;
export type MotionOutput = (typeof MOTION_OUTPUTS)[number];

export type MotionValue = number | string | boolean;
export type MotionValues = Record<string, MotionValue>;

type ParamBase = { id: string; label: string; showIf?: { id: string; is: MotionValue } };
export type RangeParam = ParamBase & { type: "range"; min: number; max: number; step: number; default: number; unit?: string };
export type SelectParam = ParamBase & { type: "select"; options: { value: string; label: string }[]; default: string };
export type ColorParam = ParamBase & { type: "color"; default: string };
export type ToggleParam = ParamBase & { type: "toggle"; default: boolean };
export type MotionParam = RangeParam | SelectParam | ColorParam | ToggleParam;

/** One drawn letter: left edge, baseline, advance width, its place in the sentence, and whether its word is a 강조 단어. */
export type MotionChar = { ch: string; x: number; y: number; w: number; line: number; word: number; k: number; index: number; strong: boolean };
export type MotionLine = { y: number; x: number; w: number; top: number; height: number };
export type MotionLayout = {
  size: number;
  lineHeight: number;
  chars: MotionChar[];
  lines: MotionLine[];
  /** Writing steps: every letter, and every gap between words, is one step (as in progressive-blur.js). */
  steps: number;
  words: number;
  box: { x: number; y: number; w: number; h: number };
};

/** Seconds. intro: 등장 → 유지 → (퇴장). cycle: one period that loops without a seam. */
export type MotionTimeline = {
  timing: "intro" | "cycle";
  intro: number;
  hold: number;
  outro: number;
  period: number;
  speed: number;
  loop: boolean;
  /** Real seconds of one pass at this speed, capped at MOTION_MAX_SECONDS. */
  total: number;
};

export type MotionInput = { values: MotionValues; text: MotionLayout | null; images: CanvasImageSource[]; count: number };
export type MotionPrepared = { layout: MotionLayout | null; images: CanvasImageSource[]; timeline: MotionTimeline };

export type MotionFrame = {
  /** Timeline seconds at speed 1: 0 → intro, held at intro, then the outro. A cycle runs 0 → period. */
  t: number;
  /** Seconds since the start at this speed, never held. For blinking carets and the like. */
  clock: number;
  realT: number;
  /** Device pixels per motion unit. */
  scale: number;
  values: MotionValues;
  text: MotionLayout | null;
  images: CanvasImageSource[];
  timeline: MotionTimeline;
  surfaces: Map<string, HTMLCanvasElement>;
  ctx: CanvasRenderingContext2D;
};

export type MotionPreset = {
  id: string;
  kind: MotionKind;
  name: string;
  summary: string;
  timing: "intro" | "cycle";
  /** The value the common 세기 slider moves. */
  strength: RangeParam;
  params: MotionParam[];
  /** Overrides of the common defaults (image size, ratio, …). */
  defaults?: MotionValues;
  /** Image slots it uses: a number, or the id of the param that sets it. */
  slots?: number | string;
  /**
   * The list thumbnail's moment: a fraction of the intro (intro presets) or of the cycle (cycle presets).
   * A cycle preset's pasted video uses it for its poster too; an intro preset's poster is the end of the intro.
   */
  posterAt: number;
  /** Seconds at speed 1: the intro, or one cycle. Self-contained: uses only its arguments. */
  duration: (input: MotionInput, kit: MotionKit) => number;
  /** Seconds of the exit played before a loop starts again. Self-contained. */
  outro?: (input: MotionInput, kit: MotionKit) => number;
  /** Draws one frame in motion units. Self-contained: uses only its arguments, so code copy can paste its source. */
  draw: (ctx: CanvasRenderingContext2D, frame: MotionFrame, kit: MotionKit) => void;
};

export function rangeParam(id: string, label: string, min: number, max: number, step: number, value: number, unit?: string, showIf?: ParamBase["showIf"]): RangeParam {
  return { id, label, type: "range", min, max, step, default: value, ...(unit ? { unit } : {}), ...(showIf ? { showIf } : {}) };
}

export function selectParam(id: string, label: string, options: [string, string][], value: string, showIf?: ParamBase["showIf"]): SelectParam {
  return { id, label, type: "select", options: options.map(([option, name]) => ({ value: option, label: name })), default: value, ...(showIf ? { showIf } : {}) };
}

export function colorParam(id: string, label: string, value: string, showIf?: ParamBase["showIf"]): ColorParam {
  return { id, label, type: "color", default: value, ...(showIf ? { showIf } : {}) };
}

export function toggleParam(id: string, label: string, value: boolean, showIf?: ParamBase["showIf"]): ToggleParam {
  return { id, label, type: "toggle", default: value, ...(showIf ? { showIf } : {}) };
}

/** 공통: every preset. 유지 is for intro presets only. */
const SPEED = rangeParam("speed", "속도", 0.25, 3, 0.05, 1, "×");
const LOOP = toggleParam("loop", "반복", true);
const HOLD = rangeParam("hold", "유지", 0, 5, 0.1, 1.5, "초");
const BACKGROUND = selectParam("background", "배경", [["transparent", "투명"], ["solid", "단색"]], "transparent");
const BACKGROUND_COLOR = colorParam("backgroundColor", "배경색", "#010102", { id: "background", is: "solid" });

export const TYPO_PARAMS: readonly MotionParam[] = [
  selectParam("font", "글꼴", [["montserrat", "Montserrat"], ["pretendard", "Pretendard"], ["roboto", "Roboto"]], "montserrat"),
  rangeParam("weight", "기본 굵기", 100, 900, 100, 300),
  rangeParam("strongWeight", "강조 굵기", 100, 900, 100, 700),
  toggleParam("autoSize", "크기 자동", true),
  rangeParam("fontSize", "크기", 40, 320, 1, 120, "px", { id: "autoSize", is: false }),
  selectParam("align", "정렬", [["left", "왼쪽"], ["center", "가운데"], ["right", "오른쪽"]], "center"),
  rangeParam("spacing", "자간", -0.1, 0.4, 0.01, 0, "em"),
  rangeParam("lineHeight", "행간", 0.8, 1.8, 0.05, 1.1),
  colorParam("color", "글자색", "#FCFCFF"),
  rangeParam("padding", "여백", 0, 25, 1, 10, "%"),
];

export const IMAGE_PARAMS: readonly MotionParam[] = [
  rangeParam("imageSize", "이미지 크기", 30, 100, 1, 72, "%"),
  selectParam("ratio", "비율", [["original", "원본"], ["1:1", "1:1"], ["4:5", "4:5"], ["3:4", "3:4"], ["16:9", "16:9"]], "original"),
  selectParam("fit", "맞춤", [["cover", "채우기"], ["contain", "전체 보기"]], "cover"),
  rangeParam("radius", "모서리", 0, 120, 1, 24, "px"),
  rangeParam("shadow", "그림자", 0, 100, 1, 30),
];

/** Typography text color by app mode, unless the preset or the user sets one. */
export const MOTION_INK = { dark: "#FCFCFF", light: "#010102" } as const;

export type MotionGroup = { title: string; params: MotionParam[] };

function withDefault<T extends MotionParam>(param: T, defaults: MotionValues | undefined): T {
  const value = defaults?.[param.id];
  return value === undefined ? param : { ...param, default: value } as T;
}

/** The controller panel: 공통, 글자 or 이미지, 이 효과, 배경. 세기 shows what it moves. */
export function motionGroups(preset: MotionPreset): MotionGroup[] {
  const own = (list: readonly MotionParam[]) => list.map((param) => withDefault(param, preset.defaults));
  const strength = { ...withDefault(preset.strength, preset.defaults), label: `세기 · ${preset.strength.label}` };
  const common: MotionParam[] = [withDefault(SPEED, preset.defaults), strength, withDefault(LOOP, preset.defaults)];
  if (preset.timing === "intro") common.push(withDefault(HOLD, preset.defaults));
  return [
    { title: "공통", params: common },
    { title: preset.kind === "typography" ? "글자" : "이미지", params: own(preset.kind === "typography" ? TYPO_PARAMS : IMAGE_PARAMS) },
    { title: "이 효과", params: own(preset.params) },
    { title: "배경", params: own([BACKGROUND, BACKGROUND_COLOR]) },
  ];
}

export function motionParams(preset: MotionPreset): MotionParam[] {
  return motionGroups(preset).flatMap((group) => group.params);
}

/** A stored value checked against its field: the value as it should be kept, or undefined when it does not fit. */
function checkValue(param: MotionParam, value: unknown): MotionValue | undefined {
  if (param.type === "range") return typeof value === "number" && Number.isFinite(value) ? snap(value, param) : undefined;
  if (param.type === "select") return typeof value === "string" && param.options.some((option) => option.value === value) ? value : undefined;
  if (param.type === "color") return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : undefined;
  return typeof value === "boolean" ? value : undefined;
}

/** The schema's own starting values. Typography ink follows the app mode. */
export function factoryMotionValues(preset: MotionPreset, mode: "light" | "dark" = "dark"): MotionValues {
  const values: MotionValues = {};
  for (const param of motionParams(preset)) values[param.id] = param.default;
  if (preset.kind === "typography" && preset.defaults?.color === undefined) values.color = MOTION_INK[mode];
  if (preset.timing === "cycle") values.hold = 0;
  return values;
}

/** Starting values: the factory values with what 이 값을 기본값으로 설정 saved for this preset. */
export function defaultMotionValues(preset: MotionPreset, mode: "light" | "dark" = "dark"): MotionValues {
  const values = factoryMotionValues(preset, mode);
  const own = saved.values[preset.id];
  if (own) {
    for (const param of motionParams(preset)) {
      const value = checkValue(param, own[param.id]);
      if (value !== undefined) values[param.id] = value;
    }
  }
  return values;
}

/** The values that differ from `base`: what is stored for a preset. */
export function changedMotionValues(values: MotionValues, base: MotionValues): MotionValues {
  const changed: MotionValues = {};
  for (const [id, value] of Object.entries(values)) if (base[id] !== value) changed[id] = value;
  return changed;
}

function snap(value: number, param: RangeParam): number {
  const clamped = Math.min(param.max, Math.max(param.min, value));
  const steps = Math.round((clamped - param.min) / param.step);
  return Number((param.min + steps * param.step).toFixed(6));
}

/** Stored values, checked against the schema: a missing or broken value takes its default, a number is kept in range. */
export function normalizeMotionValues(preset: MotionPreset, raw: unknown, mode: "light" | "dark" = "dark"): MotionValues {
  const values = defaultMotionValues(preset, mode);
  if (!raw || typeof raw !== "object") return values;
  const stored = raw as Record<string, unknown>;
  for (const param of motionParams(preset)) {
    const value = checkValue(param, stored[param.id]);
    if (value !== undefined) values[param.id] = value;
  }
  return values;
}

/** Whether a field shows, given the other values (배경색 only for 단색, and the like). */
export function paramShown(param: MotionParam, values: MotionValues): boolean {
  return !param.showIf || values[param.showIf.id] === param.showIf.is;
}

function cleanText(raw: unknown): string {
  return typeof raw === "string" ? [...raw.replace(/\s+/g, " ").trim()].slice(0, MOTION_TEXT_MAX).join("").trim() : "";
}

/** The sentence as typed: one line of spaces, at most MOTION_TEXT_MAX letters. Empty is the default sentence. */
export function motionText(raw: unknown): string {
  return cleanText(raw) || defaultSentence();
}

/** The sentence an empty input shows: the saved one, or `AX gives people room to grow`. */
export function defaultSentence(): string {
  return saved.text || MOTION_DEFAULT_TEXT;
}

/** The words of a sentence, as the layout splits them. 강조 단어 are indexes into this list. */
export function motionWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** The default sentence's 강조 단어: the saved ones, or AX, people, grow. */
export function defaultStrong(): number[] {
  return [...(saved.strong ?? (saved.text ? [] : MOTION_DEFAULT_STRONG))];
}

/** The 강조 단어 of `text`: as stored for it, or (nothing stored) the default sentence's own; a sentence typed fresh has none. */
export function motionStrong(text: string, stored: readonly number[] | null | undefined): number[] {
  const count = motionWords(text).length;
  const marks = stored ?? (text === defaultSentence() ? defaultStrong() : []);
  return [...new Set(marks)].filter((at) => Number.isInteger(at) && at >= 0 && at < count).sort((a, b) => a - b);
}

/**
 * Keeps the 강조 단어 while the sentence is edited. With as many words as before, each place keeps its mark (a word was
 * edited in place). Otherwise the words that stay (their longest common run) keep theirs, and new words are plain.
 */
export function carryStrong(before: readonly string[], strong: readonly number[], after: readonly string[]): number[] {
  const marked = new Set(strong);
  if (before.length === after.length) return after.flatMap((_, at) => (marked.has(at) ? [at] : []));
  const rows = before.length;
  const cols = after.length;
  const common = Array.from({ length: rows + 1 }, () => new Array<number>(cols + 1).fill(0));
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      common[i]![j] = before[i] === after[j] ? common[i + 1]![j + 1]! + 1 : Math.max(common[i + 1]![j]!, common[i]![j + 1]!);
    }
  }
  const result: number[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      if (marked.has(i)) result.push(j);
      i += 1;
      j += 1;
    } else if (common[i + 1]![j]! >= common[i]![j + 1]!) i += 1;
    else j += 1;
  }
  return result;
}

/* ---------- 이 값을 기본값으로 설정 ---------- */

/**
 * Defaults saved with 이 값을 기본값으로 설정, in presentation/motions.json: per preset the values that differ from the
 * factory, and the default sentence, its 강조 단어, and the image slots. The dev server writes the file; a build carries it.
 */
export type MotionDefaults = { values: Record<string, MotionValues>; text?: string; strong?: number[]; slots?: (string | null)[] };
export const MOTION_DEFAULTS_FILE = "motions.json";
export const MOTION_DEFAULTS_ROUTE = "/__motions-defaults";

let saved: MotionDefaults = { values: {} };

export function setMotionDefaults(next: MotionDefaults): void {
  saved = next;
}

export function motionDefaults(): MotionDefaults {
  return saved;
}

/** presentation/motions.json, checked: unknown keys go, values stay plain, slots never point at a file of mine. */
export function parseMotionDefaults(raw: unknown): MotionDefaults {
  const parsed: MotionDefaults = { values: {} };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return parsed;
  const record = raw as { values?: unknown; text?: unknown; strong?: unknown; slots?: unknown };
  if (record.values && typeof record.values === "object" && !Array.isArray(record.values)) {
    for (const [id, values] of Object.entries(record.values as Record<string, unknown>)) {
      if (!values || typeof values !== "object" || Array.isArray(values)) continue;
      const plain = Object.entries(values as Record<string, unknown>).filter(
        (entry): entry is [string, MotionValue] => ["number", "string", "boolean"].includes(typeof entry[1]),
      );
      if (plain.length) parsed.values[id] = Object.fromEntries(plain);
    }
  }
  const text = cleanText(record.text);
  if (text) parsed.text = text;
  if (Array.isArray(record.strong)) {
    parsed.strong = [...new Set(record.strong.filter((at): at is number => Number.isInteger(at) && at >= 0))].sort((a, b) => a - b);
  }
  if (Array.isArray(record.slots)) {
    const slots = record.slots as unknown[];
    parsed.slots = Array.from({ length: MOTION_SLOTS }, (_, at) => {
      const ref = slots[at];
      return typeof ref === "string" && /^(lib|pres|conf|bg):/.test(ref) ? ref : null;
    });
  }
  return parsed;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** "motion-typo-shine-20261126-153012.webm": the page-folder name of a pasted motion video. */
export function motionFileName(presetId: string, date: Date, ext: "webm" | "mp4"): string {
  const day = `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
  const time = `${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
  return `motion-${presetId}-${day}-${time}.${ext}`;
}

/** The poster beside a motion video: "<name>.poster.png". */
export function posterNameFor(name: string): string {
  return `${name.replace(/\.(webm|mp4|mov)$/i, "")}.poster.png`;
}

export function isPosterName(name: string): boolean {
  return /\.poster\.png$/i.test(name);
}

/** URL of the poster beside a pasted motion video, or null when the URL is not one (other videos keep their first frame). */
export function posterUrlFor(url: string): string | null {
  const queryAt = url.search(/[?#]/);
  const path = queryAt >= 0 ? url.slice(0, queryAt) : url;
  const slash = path.lastIndexOf("/");
  let name = path.slice(slash + 1);
  try {
    name = decodeURIComponent(name);
  } catch {
    return null;
  }
  if (!/^motion-.+\.(webm|mp4)$/i.test(name)) return null;
  return `${path.slice(0, slash + 1)}${encodeURIComponent(posterNameFor(name))}`;
}
