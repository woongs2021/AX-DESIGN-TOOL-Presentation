import type { MotionKind } from "./shared/motions.ts";

/**
 * #/projects is the first screen. #/presentation/<projectId> edits one project; #/presentation opens the last one.
 * #/motions/<kind>/<presetId> shows one motion preset; #/motions and #/motions/<kind> open the last one.
 */
export type Route =
  | { name: "projects" }
  | { name: "presentation"; project: string | null }
  | { name: "motions"; kind: MotionKind | null; preset: string | null }
  | { name: "notfound"; path: string };

const PROJECT_ID = "project-[A-Za-z0-9-]{1,64}";
const PRESET_ID = "[a-z0-9-]{1,64}";

function pathOf(hash: string): string {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const queryAt = raw.indexOf("?");
  const pathPart = queryAt >= 0 ? raw.slice(0, queryAt) : raw;
  const path = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  return path === "/" ? "/" : path.replace(/\/+$/, "") || "/";
}

export function parseHash(hash = window.location.hash): Route {
  const path = pathOf(hash);
  if (path === "/projects") return { name: "projects" };
  if (path === "/presentation") return { name: "presentation", project: null };
  const project = path.match(new RegExp(`^/presentation/(${PROJECT_ID})$`));
  if (project) return { name: "presentation", project: project[1]! };
  if (path === "/motions") return { name: "motions", kind: null, preset: null };
  const motion = path.match(new RegExp(`^/motions/(typography|image)(?:/(${PRESET_ID}))?$`));
  if (motion) return { name: "motions", kind: motion[1] as MotionKind, preset: motion[2] ?? null };
  return { name: "notfound", path };
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case "projects":
      return "#/projects";
    case "presentation":
      return route.project ? `#/presentation/${route.project}` : "#/presentation";
    case "motions":
      if (!route.kind) return "#/motions";
      return route.preset ? `#/motions/${route.kind}/${route.preset}` : `#/motions/${route.kind}`;
    case "notfound":
      return `#${route.path}`;
  }
}

export function onRouteChange(handler: (route: Route) => void): () => void {
  const listener = () => handler(parseHash());
  window.addEventListener("hashchange", listener);
  handler(parseHash());
  return () => window.removeEventListener("hashchange", listener);
}
