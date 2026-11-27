/**
 * Motions on a Presentation layer. A motion keeps its 1080 square; the square is placed around the layer and scaled so
 * the motion covers the layer exactly: a text layer's letters sit where the editor draws them, an image preset's card
 * is the layer's box. Pure: the editor passes its own measurements.
 */
import {
  factoryMotionValues,
  MOTION_SIZE,
  motionParams,
  normalizeMotionValues,
  type MotionChar,
  type MotionLayout,
  type MotionParam,
  type MotionPreset,
  type MotionValues,
} from "../shared/motions.ts";

/** Card pixels: the square's top-left corner and side. */
export type MotionSquare = { x: number; y: number; side: number };
type Box = { x: number; y: number; w: number; h: number };

/** A text block and room around it for blur, rise, and waves. */
export function textSquare(box: Box, size: number): MotionSquare {
  const margin = Math.max(size * 0.6, 24);
  const side = Math.max(box.w, box.h, 1) + margin * 2;
  return { x: box.x + box.w / 2 - side / 2, y: box.y + box.h / 2 - side / 2, side };
}

/** A picture: the square in which the preset's card (imageSize % of the square's long side) is the layer's box. */
export function imageSquare(box: Box, imageSize: number): MotionSquare {
  const side = Math.max(box.w, box.h, 1) / Math.max(0.05, imageSize / 100);
  return { x: box.x + box.w / 2 - side / 2, y: box.y + box.h / 2 - side / 2, side };
}

/** One line as the editor draws it: its text and its top-left corner in card pixels (canvas textBaseline "top"). */
export type TextLine = { text: string; x: number; y: number };

/**
 * The letters as the editor draws them, in the square's 1080 units: each line's text at its place, the alphabetic
 * baseline `ascent` below the line top, letter by letter from the line's own measure. Words and writing steps are
 * counted as Motions counts them (a gap between words is one step).
 */
export function textLayout(
  lines: readonly TextLine[],
  size: number,
  lineHeight: number,
  ascent: number,
  measure: (text: string) => number,
  square: MotionSquare,
): MotionLayout {
  const unit = MOTION_SIZE / square.side;
  const chars: MotionChar[] = [];
  const rows: MotionLayout["lines"] = [];
  let k = 0;
  let index = 0;
  let word = -1;
  lines.forEach((line, lineIndex) => {
    const glyphs = Array.from(line.text);
    let inWord = false;
    glyphs.forEach((ch, at) => {
      if (/\s/.test(ch)) {
        inWord = false;
        return;
      }
      if (!inWord) {
        word += 1;
        if (index > 0) k += 1;
        inWord = true;
      }
      chars.push({
        ch,
        x: (line.x + measure(glyphs.slice(0, at).join("")) - square.x) * unit,
        y: (line.y + ascent - square.y) * unit,
        w: measure(ch) * unit,
        line: lineIndex,
        word,
        k,
        index,
        strong: false,
      });
      k += 1;
      index += 1;
    });
    rows.push({
      y: (line.y + ascent - square.y) * unit,
      x: (line.x - square.x) * unit,
      w: measure(line.text) * unit,
      top: (line.y - square.y) * unit,
      height: lineHeight * unit,
    });
  });
  const left = rows.length ? Math.min(...rows.map((row) => row.x)) : MOTION_SIZE / 2;
  const right = rows.length ? Math.max(...rows.map((row) => row.x + row.w)) : MOTION_SIZE / 2;
  return {
    size: size * unit,
    lineHeight: lineHeight * unit,
    chars,
    lines: rows,
    steps: k,
    words: word + 1,
    box: { x: left, y: rows[0]?.top ?? MOTION_SIZE / 2, w: right - left, h: rows.length * lineHeight * unit },
  };
}

/** The values a layer motion starts from on a preset: the preset's own, and no card shadow on a picture (the still has none). */
export function layerMotionStart(preset: MotionPreset): MotionValues {
  return { ...factoryMotionValues(preset), ...(preset.kind === "image" ? { shadow: 0 } : {}) };
}

/** A layer motion's values for the runtime: what was stored, on the preset's own values, then what the layer sets. */
export function layerMotionValues(preset: MotionPreset, stored: unknown, layer: MotionValues): MotionValues {
  return { ...normalizeMotionValues(preset, stored, "dark", layerMotionStart(preset)), ...layer, background: "transparent" };
}

/** What a layer motion stores: the values that differ from where it starts. */
export function layerMotionChanges(preset: MotionPreset, values: MotionValues): MotionValues {
  const start = layerMotionStart(preset);
  const changed: MotionValues = {};
  for (const param of layerMotionParams(preset)) if (values[param.id] !== start[param.id]) changed[param.id] = values[param.id]!;
  return changed;
}

/** The controllers a layer motion shows: 공통 and 이 효과 (and a picture's card shadow). The layer sets the rest. */
export function layerMotionParams(preset: MotionPreset): MotionParam[] {
  const ids = new Set(["speed", "loop", "hold", preset.strength.id, ...preset.params.map((param) => param.id), ...(preset.kind === "image" ? ["shadow"] : [])]);
  return motionParams(preset).filter((param) => ids.has(param.id));
}
