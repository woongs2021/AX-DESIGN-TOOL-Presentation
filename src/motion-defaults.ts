/**
 * 이 값을 기본값으로 설정: the Motions defaults in presentation/motions.json. Localhost reads and writes the file through the
 * dev server; a build carries the copy it was built with. What a browser keeps (ax-motions) sits on top of these defaults.
 */
import { presentationProjectEnabled } from "./shared/presentation-files.ts";
import { MOTION_DEFAULTS_ROUTE, parseMotionDefaults, setMotionDefaults, type MotionDefaults } from "./shared/motions.ts";

const built = import.meta.glob<unknown>("/presentation/motions.json", { eager: true, import: "default" });

/** Reads the defaults: the file as it is now on localhost, or the copy built into the site. */
export async function loadMotionDefaults(): Promise<void> {
  let raw: unknown = Object.values(built)[0] ?? null;
  if (presentationProjectEnabled()) {
    try {
      const response = await fetch(MOTION_DEFAULTS_ROUTE, { cache: "no-store" });
      if (response.ok) raw = (await response.json()) as unknown;
    } catch {
      /* The built copy stays. */
    }
  }
  setMotionDefaults(parseMotionDefaults(raw));
}

/** Writes the defaults to presentation/motions.json. Localhost only; false when it could not. */
export async function saveMotionDefaults(next: MotionDefaults): Promise<boolean> {
  if (!presentationProjectEnabled()) return false;
  try {
    const response = await fetch(MOTION_DEFAULTS_ROUTE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    if (!response.ok) return false;
    setMotionDefaults(parseMotionDefaults((await response.json()) as unknown));
    return true;
  } catch {
    return false;
  }
}
