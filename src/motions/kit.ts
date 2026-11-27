/**
 * The motion kit: timing, text layout, drawing helpers, and the frame renderer every preset shares.
 * Every method uses only its arguments, `this` (the kit), and browser globals. Code copy pastes the method
 * sources as they are (src/motions/code-export.ts), so a method must never reach a module-level name, and
 * callers always call `kit.method(...)` so `this` is the kit.
 */
import type { MotionChar, MotionFrame, MotionLayout, MotionPrepared, MotionPreset, MotionTimeline, MotionValues } from "../shared/motions.ts";

type Ctx = CanvasRenderingContext2D;
type Surface = HTMLCanvasElement & { motionSrc?: unknown; motionSig?: string; motionKey?: string };
/** strong: the 강조 단어 (word indexes), measured and drawn in 강조 굵기. */
type LayoutOptions = { size: number | null; spacing: number; lineHeight: number; align: string; padding: number; strong?: readonly number[] };
type Measure = (text: string, size: number, strong?: boolean) => number;
type Fit = { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number };

export const kit = {
  clamp(value: number, lo = 0, hi = 1): number {
    return value < lo ? lo : value > hi ? hi : value;
  },

  lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  },

  num(values: MotionValues, id: string, fallback = 0): number {
    const value = Number(values[id]);
    return Number.isFinite(value) ? value : fallback;
  },

  ease(name: string, t: number): number {
    const x = t < 0 ? 0 : t > 1 ? 1 : t;
    if (name === "sine") return -(Math.cos(Math.PI * x) - 1) / 2;
    if (name === "in3") return x * x * x;
    if (name === "out3") return 1 - Math.pow(1 - x, 3);
    if (name === "inOut3") return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    if (name === "outExpo") return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
    if (name === "outBack") {
      const c = 1.70158;
      return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
    }
    return x;
  },

  /** "#RRGGBB" with an alpha, as rgba(). */
  rgba(hex: string, alpha: number): string {
    const value = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? "ffffff";
    const n = parseInt(value, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, alpha))})`;
  },

  smooth(edge0: number, edge1: number, x: number): number {
    const t = this.clamp((x - edge0) / (edge1 - edge0 || 1));
    return t * t * (3 - 2 * t);
  },

  /** Seeded random numbers in [0, 1): the same seed gives the same sequence. */
  rng(seed: number): () => number {
    let a = Math.floor(seed) >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  /** A repeatable number in [0, 1) for these integers. */
  hash(a: number, b = 0, c = 0): number {
    let h = Math.imul(Math.floor(a) | 0, 0x27d4eb2d) ^ Math.imul(Math.floor(b) | 0, 0x165667b1) ^ Math.imul(Math.floor(c) | 0, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  },

  /* ---------- text ---------- */

  /** One of the three Motions fonts, or a whole font stack as given (a Presentation text layer's own). */
  fontFamily(id: string): string {
    if (id === "pretendard") return '"Pretendard Variable", Pretendard, system-ui, sans-serif';
    if (id === "roboto") return "Roboto, system-ui, sans-serif";
    if (id.includes(",") || id.includes('"')) return id;
    return "Montserrat, system-ui, sans-serif";
  },

  /** The CSS font of a letter: 강조 단어 use 강조 굵기, the rest 기본 굵기. */
  font(values: MotionValues, size: number, strong = false): string {
    const base = this.num(values, "weight", 300);
    const weight = strong ? this.num(values, "strongWeight", base) : base;
    return `${values.italic === true ? "italic " : ""}${Math.round(weight)} ${Math.round(size * 100) / 100}px ${this.fontFamily(String(values.font))}`;
  },

  measurer(values: MotionValues): Measure {
    const ctx = document.createElement("canvas").getContext("2d") as Ctx;
    return (text: string, size: number, strong = false) => {
      ctx.font = this.font(values, size, strong);
      return ctx.measureText(text).width;
    };
  },

  /**
   * Breaks the sentence into lines inside the square (minus padding), at the given size or the largest that fits,
   * and places every letter. A word longer than a line is broken between letters.
   */
  layout(text: string, o: LayoutOptions, measure: Measure): MotionLayout {
    const full = 1080;
    const pad = this.clamp(o.padding, 0, 0.45) * full;
    const availW = full - pad * 2;
    const availH = full - pad * 2;
    const letters = (s: string) => Array.from(s);
    const words = text.split(/\s+/).filter(Boolean);
    const strongWords = new Set(o.strong ?? []);
    const span = (s: string, size: number, strong: boolean) => measure(s, size, strong) + o.spacing * size * Math.max(0, letters(s).length - 1);
    const gap = (size: number) => measure(" ", size) + o.spacing * size * 2;
    type Part = { text: string; word: number; start: boolean; w: number; strong: boolean };
    const wrap = (size: number) => {
      const lines: { parts: Part[]; w: number }[] = [];
      let parts: Part[] = [];
      let lineW = 0;
      words.forEach((word, wordIndex) => {
        const strong = strongWords.has(wordIndex);
        const pieces: string[] = [];
        if (span(word, size, strong) <= availW) pieces.push(word);
        else {
          let piece = "";
          for (const ch of letters(word)) {
            if (piece && span(piece + ch, size, strong) > availW) {
              pieces.push(piece);
              piece = ch;
            } else piece += ch;
          }
          if (piece) pieces.push(piece);
        }
        pieces.forEach((piece, pieceIndex) => {
          const w = span(piece, size, strong);
          const add = parts.length ? gap(size) + w : w;
          const part = { text: piece, word: wordIndex, start: pieceIndex === 0, w, strong };
          if (parts.length && lineW + add > availW) {
            lines.push({ parts, w: lineW });
            parts = [part];
            lineW = w;
          } else {
            parts.push(part);
            lineW += add;
          }
        });
      });
      if (parts.length) lines.push({ parts, w: lineW });
      return lines;
    };
    const fits = (size: number) => {
      const lines = wrap(size);
      return lines.length * size * o.lineHeight <= availH && lines.every((line) => line.w <= availW + 0.5);
    };
    let size = o.size && o.size > 0 ? o.size : 0;
    if (!size) {
      let lo = 24;
      let hi = 320;
      if (!fits(lo)) size = lo;
      else {
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          if (fits(mid)) lo = mid;
          else hi = mid - 1;
        }
        size = lo;
      }
    }
    const rows = wrap(size);
    const lineHeight = size * o.lineHeight;
    const top = (full - rows.length * lineHeight) / 2;
    const chars: MotionChar[] = [];
    const lines: MotionLayout["lines"] = [];
    let k = 0;
    let index = 0;
    let minX = full;
    let maxW = 0;
    rows.forEach((row, lineIndex) => {
      const lineTop = top + lineIndex * lineHeight;
      const y = lineTop + lineHeight / 2 + size * 0.34;
      const x0 = o.align === "left" ? pad : o.align === "right" ? full - pad - row.w : (full - row.w) / 2;
      lines.push({ y, x: x0, w: row.w, top: lineTop, height: lineHeight });
      minX = Math.min(minX, x0);
      maxW = Math.max(maxW, row.w);
      let x = x0;
      row.parts.forEach((part, partIndex) => {
        if (partIndex > 0) x += gap(size);
        if (index > 0 && part.start) k += 1;
        const glyphs = letters(part.text);
        glyphs.forEach((ch, at) => {
          const before = glyphs.slice(0, at).join("");
          chars.push({ ch, x: x + measure(before, size, part.strong) + o.spacing * size * at, y, w: measure(ch, size, part.strong), line: lineIndex, word: part.word, k, index, strong: part.strong });
          k += 1;
          index += 1;
        });
        x += part.w;
      });
    });
    return {
      size,
      lineHeight,
      chars,
      lines,
      steps: k,
      words: words.length,
      box: { x: rows.length ? minX : full / 2, y: top, w: maxW, h: rows.length * lineHeight },
    };
  },

  /** Which step of the writing a letter is on: its letter, word, or line. */
  unitOf(c: MotionChar, unit: string): number {
    return unit === "word" ? c.word : unit === "line" ? c.line : c.k;
  },

  unitCount(layout: MotionLayout, unit: string): number {
    return unit === "word" ? layout.words : unit === "line" ? layout.lines.length : layout.steps;
  },

  drawChars(g: Ctx, frame: MotionFrame, color: string): void {
    const layout = frame.text;
    if (!layout) return;
    g.fillStyle = color;
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    for (const c of layout.chars) {
      g.font = this.font(frame.values, layout.size, c.strong);
      g.fillText(c.ch, c.x, c.y);
    }
  },

  canFilter(g: Ctx): boolean {
    return typeof g.filter === "string";
  },

  /** One letter, blurred by `blur` motion units. Without canvas filters the blur is drawn as a shadow. */
  fillBlurred(g: Ctx, frame: MotionFrame, ch: string, x: number, y: number, blur: number, alpha: number): void {
    g.globalAlpha = this.clamp(alpha);
    if (blur <= 0.05) {
      g.fillText(ch, x, y);
    } else if (this.canFilter(g)) {
      g.filter = `blur(${blur * frame.scale}px)`;
      g.fillText(ch, x, y);
      g.filter = "none";
    } else {
      g.save();
      g.shadowColor = String(g.fillStyle);
      g.shadowBlur = blur * 2 * frame.scale;
      g.shadowOffsetX = 20000 * frame.scale;
      g.fillText(ch, x - 20000, y);
      g.restore();
    }
    g.globalAlpha = 1;
  },

  /** When each letter is typed (seconds), with a seeded rhythm: a space waits one letter. */
  typeTimes(layout: MotionLayout | null, values: MotionValues): { at: number[]; total: number } {
    if (!layout) return { at: [], total: 0.2 };
    const per = this.num(values, "perChar", 65) / 1000;
    const jitter = this.num(values, "jitter", 30) / 100;
    const random = this.rng(17);
    const stepTime: number[] = [];
    for (let k = 0; k < layout.steps; k += 1) stepTime.push(per * (1 + jitter * (random() - 0.5) * 1.6));
    const start: number[] = [0];
    for (let k = 1; k <= layout.steps; k += 1) start.push(start[k - 1] + stepTime[k - 1]);
    return { at: layout.chars.map((c) => start[c.k]), total: start[layout.steps] };
  },

  /* ---------- timing ---------- */

  timeline(preset: MotionPreset, values: MotionValues, input: { values: MotionValues; text: MotionLayout | null; images: CanvasImageSource[]; count: number }): MotionTimeline {
    const speed = this.clamp(this.num(values, "speed", 1), 0.25, 3);
    const loop = values.loop !== false;
    if (preset.timing === "cycle") {
      const period = Math.max(0.2, preset.duration(input, this));
      return { timing: "cycle", intro: 0, hold: 0, outro: 0, period, speed, loop, total: Math.min(20, period / speed) };
    }
    const intro = Math.max(0.1, preset.duration(input, this));
    const outro = loop && preset.outro ? Math.max(0, preset.outro(input, this)) : 0;
    const hold = Math.max(0, this.num(values, "hold", 1.5));
    return { timing: "intro", intro, hold, outro, period: intro + outro, speed, loop, total: Math.min(20, intro / speed + hold + outro / speed) };
  },

  /** Timeline seconds (held during 유지) and the running clock at real second `realT`. */
  at(tl: MotionTimeline, realT: number): { t: number; clock: number } {
    const clock = realT * tl.speed;
    if (tl.timing === "cycle") return { t: ((clock % tl.period) + tl.period) % tl.period, clock };
    const intro = tl.intro / tl.speed;
    if (realT <= intro) return { t: realT * tl.speed, clock };
    if (realT <= intro + tl.hold) return { t: tl.intro, clock };
    return { t: Math.min(tl.intro + tl.outro, tl.intro + (realT - intro - tl.hold) * tl.speed), clock };
  },

  /** Real second of the list thumbnail. */
  thumbTime(tl: MotionTimeline, at: number): number {
    return tl.timing === "intro" ? (tl.intro / tl.speed) * at : tl.total * at;
  },

  /** Real second of a pasted video's poster: the settled end of an intro, or the thumbnail moment of a cycle. */
  posterTime(tl: MotionTimeline, at: number): number {
    return tl.timing === "intro" ? tl.intro / tl.speed : tl.total * at;
  },

  slotCount(preset: MotionPreset, values: MotionValues): number {
    if (typeof preset.slots === "number") return preset.slots;
    if (typeof preset.slots === "string") return Math.max(1, Math.round(this.num(values, preset.slots, 1)));
    return 0;
  },

  /** Text layout, the images in slot order (repeated to the count the preset uses), and the timeline. */
  /** strong: the 강조 단어 of `text` (word indexes). given: letters already placed (a Presentation text layer's), used as they are. */
  prepare(preset: MotionPreset, values: MotionValues, text: string, images: CanvasImageSource[], strong: readonly number[] = [], given: MotionLayout | null = null): MotionPrepared {
    let layout: MotionLayout | null = preset.kind === "typography" ? given : null;
    if (preset.kind === "typography" && !layout) {
      layout = this.layout(
        text,
        {
          size: values.autoSize === false ? this.num(values, "fontSize", 120) : null,
          spacing: this.num(values, "spacing", 0),
          lineHeight: this.num(values, "lineHeight", 1.1),
          align: String(values.align),
          padding: this.num(values, "padding", 10) / 100,
          strong,
        },
        this.measurer(values),
      );
    }
    const count = this.slotCount(preset, values);
    const list = images.length && count ? Array.from({ length: count }, (_, at) => images[at % images.length]) : [];
    const input = { values, text: layout, images: list, count };
    return { layout, images: list, timeline: this.timeline(preset, values, input) };
  },

  /** Draws the frame at real second `realT` onto ctx (any square size): background, then the preset in motion units. */
  renderFrame(ctx: Ctx, preset: MotionPreset, values: MotionValues, prepared: MotionPrepared, realT: number, surfaces: Map<string, HTMLCanvasElement>): void {
    const { t, clock } = this.at(prepared.timeline, realT);
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const scale = width / 1080;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.resetCtx(ctx);
    ctx.clearRect(0, 0, width, height);
    if (values.background === "solid") {
      ctx.fillStyle = String(values.backgroundColor);
      ctx.fillRect(0, 0, width, height);
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const frame: MotionFrame = {
      t,
      clock,
      realT,
      scale,
      values,
      text: prepared.layout,
      images: prepared.images,
      timeline: prepared.timeline,
      surfaces,
      ctx,
    };
    ctx.save();
    preset.draw(ctx, frame, this);
    ctx.restore();
  },

  /* ---------- surfaces ---------- */

  resetCtx(g: Ctx): void {
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.filter = "none";
    g.shadowColor = "rgba(0,0,0,0)";
    g.shadowBlur = 0;
    g.shadowOffsetX = 0;
    g.shadowOffsetY = 0;
    g.setLineDash([]);
  },

  /** A cleared full-frame canvas at device size, drawn in motion units like the frame. `read` keeps its pixels readable. */
  layer(frame: MotionFrame, key: string, read = false): Ctx {
    const width = frame.ctx.canvas.width;
    const height = frame.ctx.canvas.height;
    let canvas = frame.surfaces.get(key);
    if (!canvas) {
      canvas = document.createElement("canvas");
      frame.surfaces.set(key, canvas);
    }
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const g = canvas.getContext("2d", read ? { willReadFrequently: true } : undefined) as Ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    this.resetCtx(g);
    g.clearRect(0, 0, width, height);
    g.setTransform(frame.scale, 0, 0, frame.scale, 0, 0);
    return g;
  },

  /** A cleared canvas of `w` × `h` device pixels with no transform. */
  canvas(frame: MotionFrame, key: string, w: number, h: number): Ctx {
    const width = Math.max(1, Math.round(w));
    const height = Math.max(1, Math.round(h));
    let canvas = frame.surfaces.get(key);
    if (!canvas) {
      canvas = document.createElement("canvas");
      frame.surfaces.set(key, canvas);
    }
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const g = canvas.getContext("2d") as Ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    this.resetCtx(g);
    g.clearRect(0, 0, width, height);
    return g;
  },

  /** Draws a layer onto ctx pixel for pixel, moved by (dx, dy) motion units. */
  blit(ctx: Ctx, frame: MotionFrame, g: Ctx, alpha = 1, dx = 0, dy = 0): void {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = this.clamp(alpha);
    ctx.drawImage(g.canvas, dx * frame.scale, dy * frame.scale);
    ctx.restore();
  },

  /* ---------- images ---------- */

  imageSize(img: CanvasImageSource): { w: number; h: number } {
    const source = img as { naturalWidth?: number; naturalHeight?: number; width?: unknown; height?: unknown };
    const w = source.naturalWidth || (typeof source.width === "number" ? source.width : 0) || 1080;
    const h = source.naturalHeight || (typeof source.height === "number" ? source.height : 0) || 1080;
    return { w, h };
  },

  /** The card box: 이미지 크기 is its longer side, 비율 its shape (원본 follows the image). */
  cardSize(values: MotionValues, img: CanvasImageSource | undefined): { w: number; h: number } {
    const side = (this.num(values, "imageSize", 72) / 100) * 1080;
    const ratio = String(values.ratio);
    const natural = img ? this.imageSize(img) : { w: 1, h: 1 };
    const r = ratio === "1:1" ? 1 : ratio === "4:5" ? 0.8 : ratio === "3:4" ? 0.75 : ratio === "16:9" ? 16 / 9 : natural.w / natural.h;
    return r >= 1 ? { w: side, h: side / r } : { w: side * r, h: side };
  },

  /** Where the image goes in a w × h card: 채우기 crops it to fill, 전체 보기 fits it whole. */
  fitRect(img: CanvasImageSource, w: number, h: number, fit: string): Fit {
    const natural = this.imageSize(img);
    const aspect = natural.w / natural.h;
    const box = w / h;
    if (fit === "contain") {
      const dw = aspect >= box ? w : h * aspect;
      const dh = aspect >= box ? w / aspect : h;
      return { sx: 0, sy: 0, sw: natural.w, sh: natural.h, dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh };
    }
    const sw = aspect > box ? natural.h * box : natural.w;
    const sh = aspect > box ? natural.h : natural.w / box;
    return { sx: (natural.w - sw) / 2, sy: (natural.h - sh) / 2, sw, sh, dx: 0, dy: 0, dw: w, dh: h };
  },

  roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();
  },

  /** The image as a rounded card of w × h motion units, kept until the image, size, radius, or fit changes. */
  texture(frame: MotionFrame, key: string, img: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
    const width = Math.max(2, Math.round(w * frame.scale));
    const height = Math.max(2, Math.round(h * frame.scale));
    const sig = `${width}x${height}:${frame.values.radius}:${frame.values.fit}`;
    let canvas = frame.surfaces.get(key) as Surface | undefined;
    if (canvas && canvas.motionSrc === img && canvas.motionSig === sig) return canvas;
    if (!canvas) {
      canvas = document.createElement("canvas") as Surface;
      frame.surfaces.set(key, canvas);
    }
    canvas.width = width;
    canvas.height = height;
    canvas.motionSrc = img;
    canvas.motionSig = sig;
    canvas.motionKey = key;
    const g = canvas.getContext("2d") as Ctx;
    const fit = this.fitRect(img, width, height, String(frame.values.fit));
    g.save();
    this.roundRect(g, fit.dx, fit.dy, fit.dw, fit.dh, this.num(frame.values, "radius", 24) * frame.scale);
    g.clip();
    try {
      g.drawImage(img, fit.sx, fit.sy, fit.sw, fit.sh, fit.dx, fit.dy, fit.dw, fit.dh);
    } catch {
      g.fillStyle = "#16427C";
      g.fillRect(0, 0, width, height);
    }
    g.restore();
    return canvas;
  },

  /** A darker copy of a texture (0 = as is, 1 = black), for cards turned away from the light. */
  shaded(frame: MotionFrame, tex: HTMLCanvasElement, amount: number): HTMLCanvasElement {
    if (amount <= 0.005) return tex;
    const g = this.canvas(frame, `${(tex as Surface).motionKey ?? "tex"}:shade`, tex.width, tex.height);
    g.drawImage(tex, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = `rgba(0,0,0,${this.clamp(amount, 0, 0.92)})`;
    g.fillRect(0, 0, tex.width, tex.height);
    return g.canvas;
  },

  /** Draws a card texture with the 그림자 shadow, falling straight down on screen whatever the card's turn. */
  drawCard(g: Ctx, frame: MotionFrame, tex: HTMLCanvasElement, x: number, y: number, w: number, h: number, alpha = 1): void {
    const s = this.num(frame.values, "shadow", 30) / 100;
    g.save();
    g.globalAlpha = this.clamp(alpha);
    if (s > 0) {
      g.shadowColor = `rgba(0,0,0,${0.2 + 0.4 * s})`;
      g.shadowBlur = (8 + 64 * s) * frame.scale;
      g.shadowOffsetY = (4 + 26 * s) * frame.scale;
    }
    g.drawImage(tex, x, y, w, h);
    g.restore();
  },

  /** A soft oval shadow on the floor under a card standing at (cx, y). */
  floorShadow(g: Ctx, frame: MotionFrame, cx: number, y: number, w: number, alpha = 1): void {
    const s = (this.num(frame.values, "shadow", 30) / 100) * alpha;
    if (s <= 0 || w <= 1) return;
    g.save();
    g.translate(cx, y);
    g.scale(1, 0.14);
    const r = w * 0.6;
    const gradient = g.createRadialGradient(0, 0, 0, 0, 0, r);
    gradient.addColorStop(0, `rgba(0,0,0,${0.5 * s})`);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gradient;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.restore();
  },

  /**
   * A card turned by `angle` (radians) about its vertical ("y") or horizontal ("x") axis, drawn as thin strips
   * with perspective (0 = flat, 100 = strong). Facing away it shows `back`, or the mirrored front.
   */
  project(g: Ctx, frame: MotionFrame, tex: HTMLCanvasElement, cx: number, cy: number, w: number, h: number, angle: number, persp: number, axis: string, back: HTMLCanvasElement | null, shade = 0): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const facing = cos >= 0;
    const turnedAway = !facing && !!back;
    let src = facing ? tex : (back ?? tex);
    src = this.shaded(frame, src, this.clamp(shade + (1 - Math.abs(cos)) * 0.3 + (facing ? 0 : 0.1)));
    const vertical = axis !== "x";
    const length = vertical ? w : h;
    const depth = vertical ? h : w;
    const count = Math.max(16, Math.min(110, Math.round((length * frame.scale) / 5)));
    const distance = Math.max(w, h) * (1.15 + (1 - this.clamp(persp / 100)) * 9);
    const srcLength = vertical ? src.width : src.height;
    const srcDepth = vertical ? src.height : src.width;
    for (let i = 0; i < count; i += 1) {
      const u0 = i / count;
      const u1 = (i + 1) / count;
      const p0 = (u0 - 0.5) * length;
      const p1 = (u1 - 0.5) * length;
      const f0 = distance / (distance + p0 * sin);
      const f1 = distance / (distance + p1 * sin);
      const a = p0 * cos * f0;
      const b = p1 * cos * f1;
      const lo = Math.min(a, b);
      const size = Math.abs(b - a) + 0.8 / frame.scale;
      const across = (depth * (f0 + f1)) / 2;
      const s0 = (turnedAway ? 1 - u1 : u0) * srcLength;
      const ss = srcLength / count;
      if (size <= 0.01) continue;
      if (vertical) g.drawImage(src, s0, 0, ss, srcDepth, cx + lo, cy - across / 2, size, across);
      else g.drawImage(src, 0, s0, srcDepth, ss, cx - across / 2, cy + lo, across, size);
    }
  },

  /**
   * The eye lens: copies `src` (a readable full-frame layer) to ctx, with the circle at (cx, cy), radius R motion units,
   * bulged by `zoom`. soft eases the bulge into the rim; aberration splits red and blue a little.
   */
  lensBlit(ctx: Ctx, frame: MotionFrame, src: Ctx, cx: number, cy: number, R: number, zoom: number, soft: number, aberration: number): void {
    const scale = frame.scale;
    const width = src.canvas.width;
    const height = src.canvas.height;
    const px = cx * scale;
    const py = cy * scale;
    const r = Math.max(2, Math.round(R * scale));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.clip("evenodd");
    ctx.drawImage(src.canvas, 0, 0);
    ctx.restore();
    const x0 = Math.round(px) - r;
    const y0 = Math.round(py) - r;
    const d = r * 2;
    if (x0 + d <= 0 || y0 + d <= 0 || x0 >= width || y0 >= height) return;
    const input = src.getImageData(x0, y0, d, d).data;
    const outCtx = this.canvas(frame, "lens:out", d, d);
    const output = outCtx.createImageData(d, d);
    const out = output.data;
    const row = d * 4;
    const centerX = px - x0;
    const centerY = py - y0;
    const shift = [1 + aberration * 0.06, 1, 1 - aberration * 0.06, 1];
    for (let y = 0; y < d; y += 1) {
      for (let x = 0; x < d; x += 1) {
        const dx = x + 0.5 - centerX;
        const dy = y + 0.5 - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= r) continue;
        const n = dist / r;
        const edge = soft > 0 ? this.smooth(1 - soft * 0.7, 1, n) : 0;
        const sampleN = Math.pow(n, zoom) * (1 - edge) + n * edge;
        const o = y * row + x * 4;
        for (let channel = 0; channel < 4; channel += 1) {
          const sn = Math.min(1, sampleN * shift[channel]);
          const ratio = dist > 0 ? (sn * r) / dist : 0;
          const fx = Math.min(d - 1.001, Math.max(0, centerX + dx * ratio - 0.5));
          const fy = Math.min(d - 1.001, Math.max(0, centerY + dy * ratio - 0.5));
          const ix = fx | 0;
          const iy = fy | 0;
          const tx = fx - ix;
          const ty = fy - iy;
          const i00 = iy * row + ix * 4 + channel;
          const top = input[i00] * (1 - tx) + input[i00 + 4] * tx;
          const bottom = input[i00 + row] * (1 - tx) + input[i00 + row + 4] * tx;
          out[o + channel] = top * (1 - ty) + bottom * ty;
        }
      }
    }
    outCtx.putImageData(output, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(outCtx.canvas, x0, y0);
    ctx.restore();
  },
};

export type MotionKit = typeof kit;
