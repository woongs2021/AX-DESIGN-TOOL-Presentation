/**
 * The projects in presentation/ when the site was built: each project.json and deck.json, and the URL of its thumbnail.webp.
 * Localhost reads the folders through the dev server instead, so a project made there shows up without a rebuild.
 */
export type BuiltProject = { dir: string; meta: unknown; deck: unknown; thumbnail: string | null };

const metas = import.meta.glob<unknown>("/presentation/*/project.json", { eager: true, import: "default" });
const decks = import.meta.glob<unknown>("/presentation/*/deck.json", { eager: true, import: "default" });
const thumbs = import.meta.glob<string>("/presentation/*/thumbnail.webp", { eager: true, query: "?url", import: "default" });

const dirOf = (path: string) => path.split("/")[2] ?? "";

export const BUILT_PROJECTS: BuiltProject[] = Object.entries(metas).map(([path, meta]) => {
  const dir = dirOf(path);
  return {
    dir,
    meta,
    deck: decks[`/presentation/${dir}/deck.json`] ?? null,
    thumbnail: thumbs[`/presentation/${dir}/thumbnail.webp`] ?? null,
  };
});
