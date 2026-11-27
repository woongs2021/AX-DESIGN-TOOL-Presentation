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

/** One motion in an exported deck: the preset's id, its values, and the letters or the still (a data URL). */
export type DeckMotion = { preset: MotionPreset; values: MotionValues; layout: unknown; image: string | null };

/**
 * The HTML export's motion player: the kit, the presets the deck uses, and every motion, each drawn on its own
 * canvas[data-motion] while its slide shows. window.axMotions.start(slide) plays a slide's motions from the start,
 * stop(slide) stops them. A pass that does not loop holds its last frame.
 */
export function motionDeckScript(motions: readonly DeckMotion[]): string {
  const presets = [...new Map(motions.map((motion) => [motion.preset.id, motion.preset])).values()];
  const defs = motions.map((motion) => ({ preset: motion.preset.id, values: motion.values, layout: motion.layout, image: motion.image }));
  return `(() => {
"use strict";
const __name = (target) => target;
const kit = ${kitSource()};
const presets = {
${presets.map((preset) => `${json(preset.id)}: ${presetSource(preset)}`).join(",\n")}
};
const defs = ${json(defs)};
const ready = new Map();
const playing = new Map();
const load = (def) => {
  if (!ready.has(def)) {
    const picture = def.image
      ? new Promise((resolve) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => resolve(null);
          image.src = def.image;
        })
      : Promise.resolve(null);
    const font = def.layout && document.fonts ? document.fonts.load(kit.font(def.values, 100), "Hg").catch(() => null) : Promise.resolve(null);
    ready.set(def, Promise.all([picture, font]).then(([image]) => kit.prepare(presets[def.preset], def.values, "", image ? [image] : [], [], def.layout || null)));
  }
  return ready.get(def);
};
const stopCanvas = (canvas) => {
  cancelAnimationFrame(playing.get(canvas) || 0);
  playing.delete(canvas);
};
window.axMotions = {
  start(slide) {
    slide.querySelectorAll("canvas[data-motion]").forEach((canvas) => {
      stopCanvas(canvas);
      const def = defs[Number(canvas.dataset.motion)];
      const preset = def && presets[def.preset];
      const ctx = canvas.getContext("2d");
      if (!preset || !ctx) return;
      const token = {};
      playing.set(canvas, 0);
      canvas.motionToken = token;
      load(def).then((prepared) => {
        if (canvas.motionToken !== token || !playing.has(canvas)) return;
        const side = Math.max(64, Math.min(1600, Math.round(canvas.getBoundingClientRect().width * (window.devicePixelRatio || 1))));
        canvas.width = side;
        canvas.height = side;
        const surfaces = new Map();
        const total = Math.max(0.001, prepared.timeline.total);
        const loop = def.values.loop !== false;
        const start = performance.now();
        const tick = (now) => {
          if (canvas.motionToken !== token || !playing.has(canvas)) return;
          const t = (now - start) / 1000;
          kit.renderFrame(ctx, preset, def.values, prepared, loop ? t % total : Math.min(t, total), surfaces);
          if (loop || t < total) playing.set(canvas, requestAnimationFrame(tick));
        };
        playing.set(canvas, requestAnimationFrame(tick));
      });
    });
  },
  stop(slide) {
    slide.querySelectorAll("canvas[data-motion]").forEach(stopCanvas);
  },
};
})();`;
}
