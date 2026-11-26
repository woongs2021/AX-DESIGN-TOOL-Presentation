/**
 * The app's own clipboard for one motion video. The system clipboard cannot hold a video file, so 영상 복사 puts it
 * here and the Presentation editor's ⌘V reads it. It lives in memory: a reload empties it.
 */
export type MotionClip = {
  blob: Blob;
  /** PNG of the settled frame, used where a still picture of the video is needed (PDF, PPTX, thumbnails). */
  poster: Blob;
  ext: "webm" | "mp4";
  type: string;
  presetId: string;
  name: string;
  size: number;
  seconds: number;
  loop: boolean;
  transparent: boolean;
};

let clip: MotionClip | null = null;

export function setMotionClip(next: MotionClip | null): void {
  clip = next;
}

export function getMotionClip(): MotionClip | null {
  return clip;
}

export function motionClipLabel(value: MotionClip | null = clip): string {
  if (!value) return "복사한 영상 없음";
  return `복사한 영상: ${value.name} · ${value.size} · ${value.seconds.toFixed(1)}초 · ${value.transparent ? "투명" : "단색"}`;
}
