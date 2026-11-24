/**
 * Conference data the Presentation reads: the conference.json contract (Slide background, speakers, logos),
 * the Slide card preset, and the file-name slugs the page-folder sync uses.
 * Without conference.json the Presentation does not load.
 */
import type { StudioPreset } from "./studio.ts";

export type ConferencePreset = StudioPreset & {
  /** Background id in conference.json. */
  background: string;
  /** Long edge of the video export when the browser encoder cannot take the card size. */
  videoFallbackEdge: number;
};

export const CONFERENCE_PRESETS: readonly ConferencePreset[] = [
  { id: "conf-slide", name: "Slide", width: 3840, height: 2160, background: "slide", videoFallbackEdge: 1920 },
];

export const CONFERENCE_SRC_PREFIX = "conf:";

export function conferencePresetById(id: string): ConferencePreset {
  return CONFERENCE_PRESETS.find((preset) => preset.id === id) ?? CONFERENCE_PRESETS[0]!;
}

export type ConferenceMedia = { path: string; width: number | null; height: number | null; bytes: number };
export type ConferenceBackground = {
  id: string;
  image: (ConferenceMedia & { dpi: number | null }) | null;
  video: (ConferenceMedia & { durationSec: number | null }) | null;
  thumbPath: string | null;
};
export type ConferenceSource = {
  id: string;
  label: string;
  path: string;
  thumbPath: string;
  format: "png" | "svg";
  width: number;
  height: number;
  bytes: number;
};
export type ConferenceIndex = {
  version: 1;
  backgrounds: ConferenceBackground[];
  speakers: ConferenceSource[];
  logos: ConferenceSource[];
};

export function conferenceSrc(source: Pick<ConferenceSource, "id">): string {
  return `${CONFERENCE_SRC_PREFIX}${source.id}`;
}

/** Background id from a Graphic Resources file name. Null when the name matches no preset. */
export function backgroundIdFor(fileName: string): string | null {
  const name = fileName.toLowerCase();
  if (name.startsWith("insta")) return "instagram";
  if (name.startsWith("poster")) return "poster";
  if (name.startsWith("slide")) return "slide";
  if (name.startsWith("x_banner")) return "banner-x";
  if (name.startsWith("l_banner")) return "banner-l";
  return null;
}

const LOGO_WORDS: readonly [string, string][] = [
  ["브루넬한인회로고", "logo-brunel-korean-society"],
  ["브루넬심벌", "logo-brunel-symbol"],
  ["브루넬로고", "logo-brunel"],
  ["성균관대로고", "logo-skku"],
  ["홍익대학교로고", "logo-hongik"],
  ["디스닷로고", "logo-disdot"],
  ["qr코드", "qr-code"],
];

/** English slug for an SVG file name; "홍익대학교 로고-01" → "logo-hongik-1". Null when no word is known. */
export function logoSlug(fileName: string): string | null {
  const base = fileName.replace(/\.svg$/i, "").normalize("NFC");
  const compact = base.replace(/\s+/g, "").toLowerCase();
  const word = LOGO_WORDS.find(([korean]) => compact.startsWith(korean));
  if (!word) return null;
  const number = compact.slice(word[0].length).match(/(\d+)$/);
  return number ? `${word[1]}-${Number(number[1])}` : word[1];
}

/** "001.png" → "speaker-001". */
export function speakerSlug(fileName: string): string | null {
  const base = fileName.replace(/\.png$/i, "").toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(base) ? `speaker-${base}` : null;
}

/** Video export sizes: the card size first, then the preset's fallback edge on the same ratio. Both even. */
export function videoExportSizes(presetId: string, cardWidth: number, cardHeight: number): { width: number; height: number }[] {
  const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);
  const first = { width: even(cardWidth), height: even(cardHeight) };
  const scale = conferencePresetById(presetId).videoFallbackEdge / Math.max(cardWidth, cardHeight);
  const fallback = { width: even(cardWidth * scale), height: even(cardHeight * scale) };
  return fallback.width === first.width && fallback.height === first.height ? [first] : [first, fallback];
}
