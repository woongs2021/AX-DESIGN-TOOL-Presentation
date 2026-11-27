/**
 * Motions (Dev Phase 3): the preset registry and schema, stored values, 강조 단어, text layout, timing, seeded randomness,
 * every preset drawn frame by frame on a recording canvas, code copy run from its own source, saved defaults, the store,
 * pasted-file names, and the addresses.
 */
import assert from "node:assert/strict";
import {
  carryStrong,
  changedMotionValues,
  defaultMotionValues,
  defaultSentence,
  defaultStrong,
  factoryMotionValues,
  isPosterName,
  MOTION_DEFAULT_STRONG,
  MOTION_DEFAULT_TEXT,
  motionFileName,
  motionGroups,
  motionParams,
  motionStrong,
  motionText,
  motionWords,
  normalizeMotionValues,
  paramShown,
  parseMotionDefaults,
  setMotionDefaults,
  posterNameFor,
  posterUrlFor,
  type MotionLayout,
  type MotionPreset,
} from "../src/shared/motions.ts";
import { kit } from "../src/motions/kit.ts";
import { MOTION_PRESETS, findMotionPreset, motionPresetsOf } from "../src/motions/index.ts";

/* ---------- a canvas that records instead of drawing ---------- */
let drawCalls = 0;
const fontsSet = new Set<string>();
const DRAWS = new Set(["fillText", "strokeText", "drawImage", "fill", "stroke", "fillRect", "putImageData"]);
type Mock = Record<string | symbol, unknown>;
function mockContext(canvas: { width: number; height: number }): CanvasRenderingContext2D {
  const state: Mock = { canvas, font: "10px sans-serif", filter: "none", fillStyle: "#000000", strokeStyle: "#000000", globalAlpha: 1 };
  const size = () => Number(/([\d.]+)px/.exec(String(state.font))?.[1] ?? 10);
  return new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === "measureText") return (text: string) => ({ width: Array.from(String(text)).length * size() * 0.55 });
      if (key === "createLinearGradient" || key === "createRadialGradient") return () => ({ addColorStop() {} });
      if (key === "getImageData" || key === "createImageData") {
        return (...args: number[]) => {
          const w = Math.max(1, Math.round(args.length === 2 ? args[0] : args[2]));
          const h = Math.max(1, Math.round(args.length === 2 ? args[1] : args[3]));
          return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
        };
      }
      return (...args: unknown[]) => {
        if (typeof key === "string" && DRAWS.has(key)) {
          drawCalls += 1;
          for (const value of args) if (typeof value === "number") assert.ok(Number.isFinite(value), `${String(key)} got a non-finite number`);
        }
      };
    },
    set(target, key, value) {
      if (key === "font") fontsSet.add(String(value));
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}
function mockCanvas(width = 300, height = 150): HTMLCanvasElement {
  const canvas = { width, height } as unknown as HTMLCanvasElement & { context?: CanvasRenderingContext2D };
  (canvas as unknown as { getContext: () => CanvasRenderingContext2D }).getContext = () => {
    canvas.context ??= mockContext(canvas);
    return canvas.context;
  };
  return canvas;
}
Object.assign(globalThis, { document: { createElement: () => mockCanvas() } });
const images = [0, 1, 2, 3].map((i) => ({ naturalWidth: 1200 + i * 100, naturalHeight: 900 }) as unknown as CanvasImageSource);

/* ---------- registry and schema ---------- */
assert.equal(MOTION_PRESETS.length, 20);
assert.equal(new Set(MOTION_PRESETS.map((preset) => preset.id)).size, 20);
assert.equal(motionPresetsOf("typography").length, 10);
assert.equal(motionPresetsOf("image").length, 10);
assert.equal(findMotionPreset("typo-eye-lens")?.name, "볼록 렌즈");
assert.equal(findMotionPreset("nope"), undefined);
for (const preset of MOTION_PRESETS) {
  assert.ok(preset.posterAt >= 0 && preset.posterAt <= 1, preset.id);
  const ids = motionParams(preset).map((param) => param.id);
  assert.equal(new Set(ids).size, ids.length, `${preset.id} param ids repeat`);
  for (const param of motionParams(preset)) {
    if (param.type === "range") assert.ok(param.min <= param.default && param.default <= param.max, `${preset.id}.${param.id} default in range`);
    if (param.type === "select") assert.ok(param.options.some((option) => option.value === param.default), `${preset.id}.${param.id} default option`);
  }
  const common = motionGroups(preset).find((group) => group.title === "공통");
  assert.ok(common?.params.some((param) => param.label.startsWith("세기 · ")), `${preset.id} has 세기`);
  assert.equal(common?.params.some((param) => param.id === "hold"), preset.timing === "intro", `${preset.id} 유지 only for intro`);
  if (preset.kind === "typography") {
    assert.deepEqual(motionGroups(preset)[0]?.params.map((param) => param.id), ["spacing", "lineHeight"], `${preset.id} shows 자간·행간 first`);
  }
}
const lens = findMotionPreset("typo-eye-lens")!;
assert.equal(defaultMotionValues(lens, "dark").color, "#FCFCFF");
assert.equal(defaultMotionValues(lens, "light").color, "#010102");
const stored = normalizeMotionValues(lens, { zoom: 99, path: "zigzag", rim: "line", color: "#abcdef", speed: "fast", loop: false, extra: 1 });
assert.equal(stored.zoom, 3, "range values are kept in range");
assert.equal(stored.path, "pingpong", "an unknown option takes the default");
assert.equal(stored.rim, "line");
assert.equal(stored.color, "#ABCDEF");
assert.equal(stored.speed, 1);
assert.equal(stored.loop, false);
assert.equal(stored.extra, undefined);
const highlight = findMotionPreset("typo-highlight")!;
const words = motionParams(highlight).find((param) => param.id === "words")!;
assert.equal(paramShown(words, { range: "last" }), true);
assert.equal(paramShown(words, { range: "all" }), false);
assert.equal(findMotionPreset("img-card-fan")!.defaults?.imageSize, 46);
assert.equal(defaultMotionValues(findMotionPreset("img-card-fan")!).imageSize, 46, "a preset's own default wins");

/* ---------- the sentence ---------- */
assert.equal(motionText(""), MOTION_DEFAULT_TEXT);
assert.equal(motionText("   "), "AX gives people room to grow");
assert.equal(motionText("  두   칸 "), "두 칸");
assert.equal(Array.from(motionText("가".repeat(200))).length, 120);
assert.deepEqual(motionWords(" AX  gives people "), ["AX", "gives", "people"]);
assert.deepEqual(MOTION_DEFAULT_STRONG.map((at) => motionWords(MOTION_DEFAULT_TEXT)[at]), ["AX", "people", "grow"], "the default 강조 단어");
assert.deepEqual(motionStrong(MOTION_DEFAULT_TEXT, null), [0, 2, 5]);
assert.deepEqual(motionStrong("Design for all", null), [], "a sentence typed fresh has no 강조 단어");
assert.deepEqual(motionStrong("Design for all", [2, 2, 0, 7, -1, 1.5]), [0, 2], "stored marks are kept in range, once each");
assert.deepEqual(carryStrong(["AX", "gives"], [0], ["AXE", "gives"]), [0], "a word edited in place keeps its mark");
assert.deepEqual(carryStrong(["AX", "gives", "people"], [0, 2], ["AX", "really", "gives", "people"]), [0, 3], "a new word is plain; the others keep theirs");
assert.deepEqual(carryStrong(["AX", "gives", "people"], [0, 2], ["AX", "people"]), [0, 1], "a removed word takes its mark away");
assert.deepEqual(carryStrong(["AX", "gives", "people", "room", "to", "grow"], [0, 2, 5], ["D"]), [], "a new sentence starts plain");
const weightValues = { font: "montserrat", weight: 300, strongWeight: 700 };
assert.equal(kit.font(weightValues, 100), "300 100px Montserrat, system-ui, sans-serif");
assert.equal(kit.font(weightValues, 100, true), "700 100px Montserrat, system-ui, sans-serif", "강조 단어 use 강조 굵기");

/* ---------- text layout ---------- */
const measure = (text: string, size: number) => Array.from(text).length * size * 0.55;
const options = { size: null, spacing: 0, lineHeight: 1.1, align: "center", padding: 0.1 };
const fitted = kit.layout(MOTION_DEFAULT_TEXT, options, measure);
const inside = (layout: MotionLayout) => layout.chars.every((c) => c.x >= 108 - 0.5 && c.x + c.w <= 972 + 0.5);
assert.ok(inside(fitted), "every letter stays inside the padding");
assert.ok(fitted.lines.length * fitted.lineHeight <= 864 + 0.5);
assert.equal(fitted.chars.length, MOTION_DEFAULT_TEXT.replace(/\s/g, "").length);
assert.equal(fitted.words, 6);
assert.equal(fitted.steps, MOTION_DEFAULT_TEXT.length, "a letter or a gap is one step");
const bigger = kit.layout(MOTION_DEFAULT_TEXT, { ...options, size: fitted.size + 1 }, measure);
assert.ok(bigger.lines.length * bigger.lineHeight > 864 || !inside(bigger), "auto size is the largest that fits");
const korean = kit.layout("사람에게 자랄 틈을 주는 AX", options, measure);
assert.ok(inside(korean) && korean.words === 5);
const long = kit.layout("Supercalifragilisticexpialidocious", { ...options, size: 200 }, measure);
assert.ok(long.lines.length > 1 && inside(long), "a word longer than a line breaks between letters");
assert.equal(long.words, 1);
const left = kit.layout("AX grows", { ...options, size: 100, align: "left" }, measure);
assert.equal(left.chars[0]?.x, 108);
const heavy = (text: string, size: number, strong = false) => Array.from(text).length * size * (strong ? 0.7 : 0.5);
const mixed = kit.layout(MOTION_DEFAULT_TEXT, { ...options, size: 100, strong: [0, 2, 5] }, heavy);
assert.deepEqual([...new Set(mixed.chars.filter((c) => c.strong).map((c) => c.word))], [0, 2, 5], "letters know their word is a 강조 단어");
assert.equal(mixed.chars.find((c) => c.ch === "A")?.w, 70, "a 강조 단어 is measured bold");
assert.equal(mixed.chars.find((c) => c.ch === "g")?.w, 50, "the rest is measured thin");
const allBold = kit.layout(MOTION_DEFAULT_TEXT, { ...options, strong: [0, 1, 2, 3, 4, 5] }, heavy);
const allThin = kit.layout(MOTION_DEFAULT_TEXT, options, heavy);
assert.ok(allBold.size < allThin.size && inside(allBold), "auto size makes room for bold words");
const spaced = kit.layout("AX grows", { ...options, size: 100, spacing: 0.2 }, measure);
assert.ok(spaced.box.w > kit.layout("AX grows", { ...options, size: 100 }, measure).box.w, "자간 widens the line");

/* ---------- timing ---------- */
const blur = findMotionPreset("typo-progressive-blur")!;
const blurValues = { ...defaultMotionValues(blur), speed: 1 };
const layout = kit.layout(MOTION_DEFAULT_TEXT, options, measure);
const input = { values: blurValues, text: layout, images: [], count: 0 };
const normal = kit.timeline(blur, blurValues, input);
assert.ok(Math.abs(normal.intro - (630 + (layout.steps - 1) * 16.5 + 1725) / 1000) < 1e-9, "progressive blur keeps progressive-blur.js timing");
assert.equal(normal.total, normal.intro + 1.5);
const fast = kit.timeline(blur, { ...blurValues, speed: 2 }, input);
assert.ok(Math.abs(fast.total - (normal.intro / 2 + 1.5)) < 1e-9, "speed 2× halves the motion, not 유지");
assert.deepEqual(kit.at(normal, normal.intro + 0.5), { t: normal.intro, clock: normal.intro + 0.5 }, "유지 holds the last frame");
const rise = findMotionPreset("typo-mask-rise")!;
const riseValues = defaultMotionValues(rise);
const looped = kit.timeline(rise, riseValues, { ...input, values: riseValues });
const once = kit.timeline(rise, { ...riseValues, loop: false }, { ...input, values: riseValues });
assert.ok(looped.outro > 0 && once.outro === 0, "the exit plays only when it loops");
const wave = findMotionPreset("typo-wave")!;
const cycle = kit.timeline(wave, { ...defaultMotionValues(wave), speed: 0.5 }, input);
assert.equal(cycle.timing, "cycle");
assert.ok(Math.abs(cycle.total - cycle.period * 2) < 1e-9);
assert.ok(Math.abs(kit.at(cycle, cycle.total).t) < 1e-9, "a cycle ends where it starts");
const slow = kit.timeline(findMotionPreset("img-marquee")!, { ...defaultMotionValues(findMotionPreset("img-marquee")!), speed: 0.25 }, { values: { ...defaultMotionValues(findMotionPreset("img-marquee")!), pace: 20 }, text: null, images, count: 6 });
assert.equal(slow.total, 20, "a pass is at most 20 seconds");

/* ---------- seeded randomness ---------- */
const a = kit.rng(7);
const b = kit.rng(7);
const first = [a(), a(), a()];
assert.deepEqual(first, [b(), b(), b()]);
assert.notDeepEqual(first, [kit.rng(8)(), kit.rng(8)(), kit.rng(8)()]);
assert.equal(kit.hash(3, 4, 5), kit.hash(3, 4, 5));
assert.ok(first.every((value) => value >= 0 && value < 1));

/* ---------- every preset draws ---------- */
function run(preset: MotionPreset, k: typeof kit, label: string, values = defaultMotionValues(preset)): void {
  const canvas = mockCanvas(540, 540);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const prepared = k.prepare(preset, values, MOTION_DEFAULT_TEXT, preset.kind === "image" ? images : [], [...MOTION_DEFAULT_STRONG]);
  assert.ok(prepared.timeline.total > 0 && prepared.timeline.total <= 20, `${label} total`);
  if (preset.kind === "image") assert.equal(prepared.images.length, k.slotCount(preset, values), `${label} uses its slots`);
  const surfaces = new Map<string, HTMLCanvasElement>();
  const before = drawCalls;
  for (const at of [0, 0.15, 0.3, 0.5, 0.7, 0.85, 0.999]) k.renderFrame(ctx, preset, values, prepared, prepared.timeline.total * at, surfaces);
  k.renderFrame(ctx, preset, values, prepared, k.thumbTime(prepared.timeline, preset.posterAt), surfaces);
  k.renderFrame(ctx, preset, values, prepared, k.posterTime(prepared.timeline, preset.posterAt), surfaces);
  assert.ok(drawCalls - before > 2, `${label} draws something`);
}
for (const preset of MOTION_PRESETS) {
  fontsSet.clear();
  run(preset, kit, preset.id);
  if (preset.kind !== "typography") continue;
  const values = defaultMotionValues(preset);
  const size = /([\d.]+)px/;
  const weightsSet = new Set([...fontsSet].filter((font) => size.test(font)).map((font) => Number(font.split(" ")[0])));
  assert.ok(weightsSet.has(Number(values.weight)) && weightsSet.has(Number(values.strongWeight)), `${preset.id} draws thin and bold words: ${[...weightsSet]}`);
}

/* ---------- code copy runs from its own source ---------- */
const { kitSource, motionCode, presetSource } = await import("../src/motions/code-export.ts");
const shim = "const __name = (target) => target;";
const pastedKit = new Function(`"use strict"; ${shim} return ${kitSource()};`)() as typeof kit;
assert.deepEqual(Object.keys(pastedKit), Object.keys(kit), "every kit method is pasted");
for (const preset of MOTION_PRESETS) {
  const pasted = new Function(`"use strict"; ${shim} return ${presetSource(preset)};`)() as MotionPreset;
  run(pasted, pastedKit, `${preset.id} (code copy)`, defaultMotionValues(preset));
  const code = motionCode(preset, defaultMotionValues(preset), MOTION_DEFAULT_TEXT, [0, 2, 5], ["https://example.com/a.png", "data:image/png;base64,AAAA"], 1080);
  const script = code.slice(code.indexOf("<script>") + 8, code.lastIndexOf("</script>"));
  assert.ok(!script.includes("</script"), `${preset.id} keeps its script closed`);
  assert.doesNotThrow(() => new Function(script), `${preset.id} snippet parses`);
  assert.match(code, /<canvas id="ax-motion-[^"]+" width="1080" height="1080"/);
  assert.match(code, /const strong = \[0,2,5\];/, `${preset.id} code keeps the 강조 단어`);
}
const tricky = motionCode(findMotionPreset("typo-shine")!, defaultMotionValues(findMotionPreset("typo-shine")!), "</script><b>x</b>", [], [], 2160);
assert.ok(!tricky.slice(tricky.indexOf("<script>") + 8, tricky.lastIndexOf("</script>")).includes("</script"), "typed text cannot close the script");

/* ---------- saved defaults (이 값을 기본값으로 설정) ---------- */
const shineDefaults = findMotionPreset("typo-shine")!;
const parsed = parseMotionDefaults({
  values: { "typo-shine": { speed: 1.5, glow: 40, nested: { no: 1 }, list: [1] }, broken: "x" },
  text: "  Design   for all  ",
  strong: [2, 0, 2, -1, 1.5],
  slots: ["lib:a", "file:mine", 3, "pres:project-1/page-01/a.png", "javascript:x"],
  extra: true,
});
assert.deepEqual(parsed.values, { "typo-shine": { speed: 1.5, glow: 40 } }, "only plain values per preset");
assert.equal(parsed.text, "Design for all");
assert.deepEqual(parsed.strong, [0, 2]);
assert.deepEqual(parsed.slots, ["lib:a", null, null, "pres:project-1/page-01/a.png", null, null, null, null], "a file of mine is never a default");
assert.deepEqual(parseMotionDefaults("nope"), { values: {} });
setMotionDefaults(parsed);
assert.equal(defaultMotionValues(shineDefaults).speed, 1.5, "saved values are the new defaults");
assert.equal(factoryMotionValues(shineDefaults).speed, 1, "the factory values stay");
assert.equal(normalizeMotionValues(shineDefaults, {}).glow, 40);
assert.equal(normalizeMotionValues(shineDefaults, { glow: 90 }).glow, 90, "what a browser keeps sits on top");
assert.equal(motionText(""), "Design for all", "the saved sentence is the default sentence");
assert.equal(defaultSentence(), "Design for all");
assert.deepEqual(motionStrong("Design for all", null), [0, 2], "with its saved 강조 단어");
setMotionDefaults(parseMotionDefaults({ values: { "typo-shine": { speed: 99 } } }));
assert.equal(defaultMotionValues(shineDefaults).speed, 3, "a saved value out of range is clamped");
assert.equal(motionText(""), MOTION_DEFAULT_TEXT);
assert.deepEqual(defaultStrong(), [0, 2, 5], "without a saved sentence the default 강조 단어 stay");
setMotionDefaults(parseMotionDefaults({ strong: [1] }));
assert.deepEqual(motionStrong(MOTION_DEFAULT_TEXT, null), [1], "saved 강조 단어 for the default sentence");
setMotionDefaults({ values: {} });
assert.deepEqual(changedMotionValues({ a: 1, b: "x", c: true }, { a: 1, b: "y", c: true }), { b: "x" });

/* ---------- motions on Presentation layers ---------- */
const { parseLayerMotion } = await import("../src/shared/studio.ts");
const { imageSquare, layerMotionChanges, layerMotionParams, layerMotionStart, layerMotionValues, textLayout, textSquare } = await import("../src/motions/layer.ts");
assert.deepEqual(parseLayerMotion({ motion: { preset: "typo-wave", values: { speed: 2, loop: false, bad: { x: 1 }, nan: Number.NaN } } }), {
  motion: { preset: "typo-wave", values: { speed: 2, loop: false } },
});
assert.deepEqual(parseLayerMotion({ motion: { preset: "../x" } }), {}, "a broken preset id is dropped");
assert.deepEqual(parseLayerMotion({}), {});
const square = textSquare({ x: 100, y: 200, w: 800, h: 150 }, 120);
assert.equal(square.side, 800 + 72 * 2, "text gets room around it");
assert.equal(square.x + square.side / 2, 500, "centered on the block");
const picture = imageSquare({ x: 0, y: 0, w: 600, h: 400 }, 60);
assert.equal(picture.side, 1000, "the preset's card (60 % of the square) is the layer's box");
const flat = (text: string) => Array.from(text).length * 50;
const placed = textLayout([{ text: "AX gives", x: 200, y: 300 }, { text: "people", x: 220, y: 420 }], 100, 120, 80, flat, { x: 0, y: 0, side: 2160 });
assert.equal(placed.size, 50, "sizes are in the square's 1080 units");
assert.equal(placed.chars.length, 13);
assert.equal(placed.chars[0]?.x, 100);
assert.equal(placed.chars[0]?.y, (300 + 80) / 2, "letters sit on the editor's baseline");
assert.equal(placed.chars[2]?.x, (200 + flat("AX ")) / 2, "a letter is measured from its line's start");
assert.deepEqual([...new Set(placed.chars.map((c) => c.word))], [0, 1, 2]);
assert.equal(placed.steps, 7 + 6 + 2, "letters plus one step per gap between words");
assert.equal(placed.lines.length, 2);
const waveLayer = findMotionPreset("typo-wave")!;
assert.deepEqual(layerMotionParams(waveLayer).map((param) => param.id).sort(), ["amp", "appear", "loop", "period", "pulse", "speed", "tilt", "wavelength"].sort(), "a text layer shows 공통 and 이 효과 only");
assert.ok(layerMotionParams(findMotionPreset("img-card-fan")!).some((param) => param.id === "shadow"), "a picture can still set its card shadow");
assert.equal(layerMotionStart(findMotionPreset("img-card-fan")!).shadow, 0, "a picture starts without a card shadow, like its still");
const run1 = layerMotionValues(waveLayer, { speed: 2, amp: 9999 }, { font: '"Pretendard Variable", sans-serif', color: "#123456" });
assert.equal(run1.speed, 2);
assert.equal(run1.amp, 160, "stored values are kept in range");
assert.equal(run1.background, "transparent", "a layer motion has no background");
assert.equal(run1.color, "#123456", "the layer sets its own color");
assert.deepEqual(layerMotionChanges(waveLayer, { ...layerMotionStart(waveLayer), speed: 1.5 }), { speed: 1.5 }, "a layer stores what it changed");
assert.equal(kit.font({ font: '"Pretendard Variable", sans-serif', weight: 700, italic: true }, 50), 'italic 700 50px "Pretendard Variable", sans-serif', "a layer's own font stack");
const given = k_prepare(waveLayer, run1, placed);
assert.equal(given.layout, placed, "a given layout is used as it is");
function k_prepare(preset: MotionPreset, values: Record<string, number | string | boolean>, layout: MotionLayout) {
  return kit.prepare(preset, values, "AX gives people", [], [], layout);
}
const { motionDeckScript } = await import("../src/motions/code-export.ts");
const deckScript = motionDeckScript([{ preset: waveLayer, values: run1, layout: placed, image: null }, { preset: findMotionPreset("img-spin-360")!, values: defaultMotionValues(findMotionPreset("img-spin-360")!), layout: null, image: "data:image/png;base64,AAAA" }]);
assert.doesNotThrow(() => new Function(deckScript), "the export's motion player parses");
assert.ok(!deckScript.includes("</script"), "and cannot close its script");

/* ---------- pasted motion files ---------- */
const named = motionFileName("typo-shine", new Date(2026, 10, 26, 9, 5, 7), "webm");
assert.equal(named, "motion-typo-shine-20261126-090507.webm");
assert.equal(posterNameFor(named), "motion-typo-shine-20261126-090507.poster.png");
assert.equal(posterNameFor("motion-a.mp4"), "motion-a.poster.png");
assert.ok(isPosterName("motion-a.poster.png") && !isPosterName("motion-a.png"));
assert.equal(
  posterUrlFor("/__presentation-media/project-1/page-01/motion-typo-shine-20261126-090507.webm"),
  "/__presentation-media/project-1/page-01/motion-typo-shine-20261126-090507.poster.png",
);
assert.equal(posterUrlFor("presentation-media/p/page/motion-x.mp4?v=2"), "presentation-media/p/page/motion-x.poster.png");
assert.equal(posterUrlFor("presentation-media/p/page/clip.mp4"), null, "other videos keep their first frame");
assert.equal(posterUrlFor("blob:http://localhost/123"), null);

/* ---------- typography examples: 강조 단어 bold, the rest lighter ---------- */
const blurStart = defaultMotionValues(findMotionPreset("typo-progressive-blur")!);
assert.deepEqual([blurStart.speed, blurStart.blur, blurStart.weight], [0.65, 31, 600], "progressive blur starts from the values set on 2026-11-28");
assert.equal(defaultMotionValues(findMotionPreset("typo-shine")!).weight, 500);
assert.equal(defaultMotionValues(findMotionPreset("typo-wave")!).spacing, 0.09);
for (const preset of motionPresetsOf("typography")) {
  const values = defaultMotionValues(preset);
  assert.ok(Number(values.strongWeight) >= 700 && Number(values.strongWeight) - Number(values.weight) >= 200, `${preset.id} 강조 단어 clearly bolder: ${values.weight}/${values.strongWeight}`);
}
assert.ok(new Set(motionPresetsOf("typography").map((preset) => defaultMotionValues(preset).font)).size >= 2, "more than one typeface");

/* ---------- the store keeps only what changed ---------- */
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
  },
});
const { MOTIONS_KEY, clearMotionsMemory, presetValues, readMotionsMemory, savePresetValues, writeMotionsMemory } = await import("../src/motions-store.ts");
const shine = findMotionPreset("typo-shine")!;
assert.deepEqual(readMotionsMemory(), { kind: "typography", last: {}, values: {}, text: "", strong: null, slots: null, output: 1080, backdrop: null });
savePresetValues(shine, { ...defaultMotionValues(shine, "dark"), speed: 1.5 }, "dark");
assert.deepEqual(readMotionsMemory().values[shine.id], { speed: 1.5 }, "only the changed value is stored");
assert.equal(presetValues(shine, "light").speed, 1.5);
assert.equal(presetValues(shine, "light").color, defaultMotionValues(shine, "light").color, "an untouched text color follows the mode");
savePresetValues(shine, defaultMotionValues(shine, "dark"), "dark");
assert.equal(readMotionsMemory().values[shine.id], undefined, "back to the defaults stores nothing");
store.set(MOTIONS_KEY, JSON.stringify({ kind: "video", last: { typography: 3, image: "img-carousel" }, text: 5, slots: ["lib:a", 3, null], slotsVersion: 2, output: 999, backdrop: "neon" }));
const odd = readMotionsMemory();
assert.equal(odd.kind, "typography");
assert.deepEqual(odd.last, { image: "img-carousel" });
assert.equal(odd.text, "");
assert.deepEqual(odd.slots, ["lib:a", null, null, null, null, null, null, null]);
assert.equal(odd.output, 1080);
assert.equal(odd.backdrop, null);
store.set(MOTIONS_KEY, JSON.stringify({ slots: ["pres:project-1/page-01/image.png", "conf:speaker-a"], text: "그대로" }));
assert.equal(readMotionsMemory().slots, null, "slots saved before the graphic-library examples go back to the examples");
assert.equal(readMotionsMemory().text, "그대로", "the rest of an older save stays");
writeMotionsMemory((memory) => {
  memory.slots = ["lib:a", null, null, null, null, null, null, null];
});
assert.equal(readMotionsMemory().slots?.[0], "lib:a", "slots saved now are kept");
writeMotionsMemory((memory) => {
  memory.strong = [0, 3];
});
assert.deepEqual(readMotionsMemory().strong, [0, 3], "the 강조 단어 are kept");
store.set(MOTIONS_KEY, JSON.stringify({ strong: [1, "x", -2, 2.5, 4] }));
assert.deepEqual(readMotionsMemory().strong, [1, 4]);
clearMotionsMemory();
assert.deepEqual(readMotionsMemory(), { kind: "typography", last: {}, values: {}, text: "", strong: null, slots: null, output: 1080, backdrop: null }, "완전 리셋 forgets everything");
store.set(MOTIONS_KEY, JSON.stringify({ values: { "typo-shine": { speed: 99, glow: "x" } } }));
assert.equal(presetValues(shine, "dark").speed, 3, "a stored value out of range is clamped");
assert.equal(presetValues(shine, "dark").glow, defaultMotionValues(shine, "dark").glow, "a stored value of the wrong type is the default");
store.set(MOTIONS_KEY, "{not json");
assert.equal(readMotionsMemory().kind, "typography", "a broken save starts fresh");

/* ---------- addresses ---------- */
const { hrefFor, parseHash } = await import("../src/router.ts");
assert.deepEqual(parseHash("#/motions"), { name: "motions", kind: null, preset: null });
assert.deepEqual(parseHash("#/motions/image/"), { name: "motions", kind: "image", preset: null });
assert.deepEqual(parseHash("#/motions/typography/typo-eye-lens"), { name: "motions", kind: "typography", preset: "typo-eye-lens" });
for (const bad of ["#/motions/video", "#/motions/image/Bad_Id", "#/motions/image/a/b"]) assert.equal(parseHash(bad).name, "notfound", bad);
assert.equal(hrefFor({ name: "motions", kind: null, preset: null }), "#/motions");
assert.equal(hrefFor({ name: "motions", kind: "image", preset: null }), "#/motions/image");
for (const preset of MOTION_PRESETS) {
  assert.deepEqual(parseHash(hrefFor({ name: "motions", kind: preset.kind, preset: preset.id })), { name: "motions", kind: preset.kind, preset: preset.id });
}

console.log("OK: motion presets, schema, values, sentence and 강조 단어, layout, timing, randomness, drawing, code copy, saved defaults, layer motions, pasted names, store, and addresses");
