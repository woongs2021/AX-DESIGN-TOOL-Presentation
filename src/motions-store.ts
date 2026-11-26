/**
 * What the Motions tab remembers in this browser (localStorage ax-motions): the last sub-tab and preset, each
 * preset's changed values, the sentence and its 강조 단어, the image slots, the output size, and the preview backdrop.
 */
import {
  MOTION_KINDS,
  MOTION_OUTPUTS,
  MOTION_SLOTS,
  changedMotionValues,
  defaultMotionValues,
  normalizeMotionValues,
  type MotionKind,
  type MotionOutput,
  type MotionPreset,
  type MotionValues,
} from "./shared/motions.ts";

export const MOTIONS_KEY = "ax-motions";
/** Slot lists saved before the examples became graphic-library only (2026-11-26) carry no version and are dropped once. */
const SLOTS_VERSION = 2;

export type MotionBackdrop = "checker" | "dark" | "light";
export type MotionsMemory = {
  kind: MotionKind;
  last: Partial<Record<MotionKind, string>>;
  /** Per preset, only the values that differ from its defaults, so an untouched text color still follows the mode. */
  values: Record<string, MotionValues>;
  /** As typed. Empty means the default sentence. */
  text: string;
  /** The sentence's 강조 단어 (word indexes), or null for the default sentence's own. */
  strong: number[] | null;
  /** Slot refs in order, or null before the slots were ever set (the defaults fill them). */
  slots: (string | null)[] | null;
  output: MotionOutput;
  backdrop: MotionBackdrop | null;
};

function blank(): MotionsMemory {
  return { kind: "typography", last: {}, values: {}, text: "", strong: null, slots: null, output: 1080, backdrop: null };
}

export function readMotionsMemory(): MotionsMemory {
  const memory = blank();
  try {
    const raw = JSON.parse(localStorage.getItem(MOTIONS_KEY) ?? "null") as Partial<MotionsMemory> | null;
    if (!raw || typeof raw !== "object") return memory;
    if (MOTION_KINDS.includes(raw.kind as MotionKind)) memory.kind = raw.kind as MotionKind;
    if (raw.last && typeof raw.last === "object") {
      for (const kind of MOTION_KINDS) if (typeof raw.last[kind] === "string") memory.last[kind] = raw.last[kind];
    }
    if (raw.values && typeof raw.values === "object") memory.values = raw.values as Record<string, MotionValues>;
    if (typeof raw.text === "string") memory.text = raw.text;
    if (Array.isArray(raw.strong)) memory.strong = raw.strong.filter((at): at is number => Number.isInteger(at) && at >= 0);
    if (Array.isArray(raw.slots) && (raw as { slotsVersion?: unknown }).slotsVersion === SLOTS_VERSION) {
      memory.slots = Array.from({ length: MOTION_SLOTS }, (_, at) => (typeof raw.slots?.[at] === "string" ? (raw.slots[at] as string) : null));
    }
    if (MOTION_OUTPUTS.includes(raw.output as MotionOutput)) memory.output = raw.output as MotionOutput;
    if (raw.backdrop === "checker" || raw.backdrop === "dark" || raw.backdrop === "light") memory.backdrop = raw.backdrop;
  } catch {
    /* A broken save starts fresh. */
  }
  return memory;
}

export function writeMotionsMemory(change: (memory: MotionsMemory) => void): void {
  const memory = readMotionsMemory();
  change(memory);
  try {
    localStorage.setItem(MOTIONS_KEY, JSON.stringify({ ...memory, slotsVersion: SLOTS_VERSION }));
  } catch {
    /* Storage is full or off: the choice still applies until the next reload. */
  }
}

export function presetValues(preset: MotionPreset, mode: "light" | "dark"): MotionValues {
  return normalizeMotionValues(preset, readMotionsMemory().values[preset.id], mode);
}

export function savePresetValues(preset: MotionPreset, values: MotionValues, mode: "light" | "dark"): void {
  const changed = changedMotionValues(values, defaultMotionValues(preset, mode));
  writeMotionsMemory((memory) => {
    if (Object.keys(changed).length) memory.values[preset.id] = changed;
    else delete memory.values[preset.id];
  });
}

/** 완전 리셋: forgets everything Motions keeps in this browser, so every preset, the sentence, and the slots start from the defaults. */
export function clearMotionsMemory(): void {
  try {
    localStorage.removeItem(MOTIONS_KEY);
  } catch {
    /* Storage is off: nothing was kept. */
  }
}
