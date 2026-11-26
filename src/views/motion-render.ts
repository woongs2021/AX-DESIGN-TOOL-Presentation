/**
 * Turns a motion into a video and a poster. Frames are drawn one at a time at exact times (not recorded live),
 * so a slow frame never drops. Transparent → WebM (VP9 with alpha), solid → MP4 (H.264), both through mediabunny.
 */
import { kit } from "../motions/kit.ts";
import { MOTION_FPS, MOTION_MAX_SECONDS, type MotionPreset, type MotionValues } from "../shared/motions.ts";

/** strong: the sentence's 강조 단어 (word indexes). */
export type MotionSetup = { preset: MotionPreset; values: MotionValues; text: string; strong: number[]; images: CanvasImageSource[] };
export type MotionVideo = { blob: Blob; poster: Blob; ext: "webm" | "mp4"; type: string; seconds: number };

/** Loads the fonts the sentence is drawn in (기본 굵기 and 강조 굵기), so the layout measures the real letters. */
export async function motionFontsReady(values: MotionValues, text: string): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([document.fonts.load(kit.font(values, 100), text), document.fonts.load(kit.font(values, 100, true), text)]);
  } catch {
    /* The fallback font draws until it arrives. */
  }
}

function squareCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  return { canvas, ctx };
}

function pngOf(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("png"))), "image/png"));
}

/** The poster: the settled end of an intro, or the thumbnail moment of a cycle. */
export async function motionPoster(setup: MotionSetup, size: number): Promise<Blob> {
  const { canvas, ctx } = squareCanvas(size);
  const prepared = kit.prepare(setup.preset, setup.values, setup.text, setup.images, setup.strong);
  kit.renderFrame(ctx, setup.preset, setup.values, prepared, kit.posterTime(prepared.timeline, setup.preset.posterAt), new Map());
  return pngOf(canvas);
}

/** Whether this browser can make the video: a transparent one needs VP9 with alpha. */
export async function motionVideoSupported(size: number, transparent: boolean): Promise<boolean> {
  if (typeof VideoEncoder === "undefined") return false;
  const { canEncodeVideo } = await import("mediabunny");
  if (transparent) return canEncodeVideo("vp9", { width: size, height: size, alpha: "keep" }).catch(() => false);
  return (await canEncodeVideo("avc", { width: size, height: size }).catch(() => false)) || canEncodeVideo("vp9", { width: size, height: size }).catch(() => false);
}

/** One pass of the motion as a video, with its poster. Null when cancelled. */
export async function encodeMotion(setup: MotionSetup, size: number, onProgress: (done: number) => void, cancel: { on: boolean }): Promise<MotionVideo | null> {
  const { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, WebMOutputFormat, canEncodeVideo } = await import("mediabunny");
  const transparent = setup.values.background !== "solid";
  const mp4 = !transparent && (await canEncodeVideo("avc", { width: size, height: size }).catch(() => false));
  const { canvas, ctx } = squareCanvas(size);
  const prepared = kit.prepare(setup.preset, setup.values, setup.text, setup.images, setup.strong);
  const seconds = Math.min(MOTION_MAX_SECONDS, prepared.timeline.total);
  const frames = Math.max(1, Math.round(seconds * MOTION_FPS));
  const surfaces = new Map<string, HTMLCanvasElement>();
  const output = new Output({ format: mp4 ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(), target: new BufferTarget() });
  const track = new CanvasSource(canvas, { codec: mp4 ? "avc" : "vp9", quality: QUALITY_HIGH, ...(transparent ? { alpha: "keep" as const } : {}) });
  output.addVideoTrack(track, { frameRate: MOTION_FPS });
  await output.start();
  for (let index = 0; index < frames; index += 1) {
    if (cancel.on) {
      await output.cancel();
      return null;
    }
    kit.renderFrame(ctx, setup.preset, setup.values, prepared, index / MOTION_FPS, surfaces);
    await track.add(index / MOTION_FPS, 1 / MOTION_FPS);
    onProgress((index + 1) / frames);
  }
  await output.finalize();
  const buffer = output.target.buffer;
  if (!buffer) throw new Error("empty");
  const type = mp4 ? "video/mp4" : "video/webm";
  return { blob: new Blob([buffer], { type }), poster: await motionPoster(setup, size), ext: mp4 ? "mp4" : "webm", type, seconds };
}
