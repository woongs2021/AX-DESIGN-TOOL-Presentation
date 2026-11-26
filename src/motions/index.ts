/** The Motions presets: 타이포그래피 10종 and 이미지 10종, in list order. */
import type { MotionKind, MotionPreset } from "../shared/motions.ts";
import { IMAGE_MOTIONS } from "./image.ts";
import { TYPOGRAPHY_MOTIONS } from "./typography.ts";

export const MOTION_PRESETS: readonly MotionPreset[] = [...TYPOGRAPHY_MOTIONS, ...IMAGE_MOTIONS];

export function motionPresetsOf(kind: MotionKind): readonly MotionPreset[] {
  return kind === "image" ? IMAGE_MOTIONS : TYPOGRAPHY_MOTIONS;
}

export function findMotionPreset(id: string | null | undefined): MotionPreset | undefined {
  return id ? MOTION_PRESETS.find((preset) => preset.id === id) : undefined;
}
