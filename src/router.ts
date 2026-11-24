/** #/projects is the first screen. #/presentation/<projectId> edits one project; #/presentation opens the last one. */
export type Route =
  | { name: "projects" }
  | { name: "presentation"; project: string | null }
  | { name: "notfound"; path: string };

const PROJECT_ID = "project-[A-Za-z0-9-]{1,64}";

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
  return { name: "notfound", path };
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case "projects":
      return "#/projects";
    case "presentation":
      return route.project ? `#/presentation/${route.project}` : "#/presentation";
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
