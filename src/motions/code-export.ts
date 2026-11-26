/**
 * 코드 복사: one HTML snippet that plays the motion as set, with no library — a canvas, the font links, and an inline
 * script holding the kit methods, the preset's own functions, the values, and a player. The functions are pasted
 * from their source, which works because every kit method and preset function is self-contained.
 */
import type { MotionPreset, MotionValues } from "../shared/motions.ts";
import { kit } from "./kit.ts";

const FONT_LINKS = [
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css",
  "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300..700;1,300..700&family=Roboto:ital,wght@0,300..700;1,300..700&display=swap",
];

/** Loads the font and pictures, then plays the motion on the canvas, looping when 반복 is on. Self-contained. */
function playMotion(
  canvas: HTMLCanvasElement,
  preset: MotionPreset,
  tools: typeof kit,
  values: MotionValues,
  text: string,
  urls: string[],
  strong: number[],
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const surfaces = new Map<string, HTMLCanvasElement>();
  // No crossOrigin: the player only shows the canvas (no image preset reads its pixels), so any server's pictures load.
  const load = (url: string) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = url;
    });
  const font =
    preset.kind === "typography" && document.fonts
      ? Promise.all([document.fonts.load(tools.font(values, 100), text), document.fonts.load(tools.font(values, 100, true), text)]).catch(() => null)
      : Promise.resolve(null);
  Promise.all([font, Promise.all(urls.map(load))]).then(([, loaded]) => {
    const images = loaded.filter((image): image is HTMLImageElement => !!image);
    const prepared = tools.prepare(preset, values, text, images, strong);
    const total = prepared.timeline.total;
    const loop = values.loop !== false;
    let start = performance.now();
    const tick = (now: number) => {
      let realT = (now - start) / 1000;
      if (realT >= total) {
        if (loop) {
          realT %= total;
          start = now - realT * 1000;
        } else realT = total;
      }
      tools.renderFrame(ctx, preset, values, prepared, realT, surfaces);
      if (loop || realT < total) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function json(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** The kit as an object literal of its methods' sources. */
export function kitSource(): string {
  const methods = Object.values(kit).map((method) => String(method));
  return `{\n${methods.join(",\n")}\n}`;
}

/** The preset's data and its own functions as an object literal. */
export function presetSource(preset: MotionPreset): string {
  const fields = [
    `id: ${json(preset.id)}`,
    `kind: ${json(preset.kind)}`,
    `timing: ${json(preset.timing)}`,
    `posterAt: ${json(preset.posterAt)}`,
    `slots: ${json(preset.slots ?? null)}`,
    `duration: ${String(preset.duration)}`,
    ...(preset.outro ? [`outro: ${String(preset.outro)}`] : []),
    `draw: ${String(preset.draw)}`,
  ];
  return `{\n${fields.join(",\n")}\n}`;
}

/** The script body that defines kit and preset and starts playing on `canvasId`. strong: the 강조 단어 of `text`. */
export function motionScript(preset: MotionPreset, values: MotionValues, text: string, strong: number[], urls: string[], canvasId: string): string {
  // __name: some bundlers keep function names by wrapping them in __name(…); here it is a no-op.
  return `(() => {
"use strict";
const __name = (target) => target;
const kit = ${kitSource()};
const preset = ${presetSource(preset)};
const values = ${json(values)};
const text = ${json(text)};
const strong = ${json(strong)};
const images = ${json(urls)};
(${String(playMotion)})(document.getElementById(${json(canvasId)}), preset, kit, values, text, images, strong);
})();`;
}

/** The whole snippet: font links, a square canvas (`size` pixels), and the script. strong: the 강조 단어 of `text`. */
export function motionCode(preset: MotionPreset, values: MotionValues, text: string, strong: number[], urls: string[], size: number): string {
  const id = `ax-motion-${preset.id}-${Math.random().toString(36).slice(2, 8)}`;
  return [
    `<!-- AX Motions · ${preset.name} · ${size} × ${size} -->`,
    ...FONT_LINKS.map((href) => `<link rel="stylesheet" href="${href}">`),
    `<div style="width:min(100%, 540px);aspect-ratio:1/1">`,
    `  <canvas id="${id}" width="${size}" height="${size}" style="display:block;width:100%;height:100%"></canvas>`,
    `</div>`,
    `<script>`,
    motionScript(preset, values, text, strong, urls, id),
    `</script>`,
    "",
  ].join("\n");
}
