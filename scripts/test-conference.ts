import assert from "node:assert/strict";
import {
  backgroundIdFor,
  CONFERENCE_PRESETS,
  conferencePresetById,
  conferenceSrc,
  logoSlug,
  speakerSlug,
  videoExportSizes,
  type ConferenceIndex,
} from "../src/shared/conference.ts";
import { bareCardColor, cardIsBare, designToCode, normalizeStudioState, rgbToHex } from "../src/shared/studio.ts";
import { createBlankPage, createPresentationDeck, createTypedPage, deckDefaults, defaultPresentationDeck, defaultsWithPage, duplicatePresentationPage, insertPresentationPage, loadPresentationDeck as loadDeck, movePresentationPages, recolorBarePages, removePresentationPage, removePresentationPages, reorderPresentationPage, savePresentationDeck as saveDeck, syncPresentationMode, type PresentationDeck } from "../src/shared/presentation.ts";
import { hrefFor, parseHash } from "../src/router.ts";
import PROJECT_1_DECK from "../presentation/project 1/deck.json";

const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
  },
});

const media = (path: string) => ({ path, width: 100, height: 100, bytes: 1 });
const index: ConferenceIndex = {
  version: 1,
  backgrounds: [
    { id: "instagram", image: { ...media("i.png"), dpi: 72 }, video: { ...media("i.mp4"), durationSec: 5 }, thumbPath: null },
    { id: "banner-l", image: { ...media("l.png"), dpi: 100 }, video: null, thumbPath: null },
    { id: "banner-x", image: { ...media("x.png"), dpi: 150 }, video: { ...media("x.mp4"), durationSec: 5 }, thumbPath: null },
  ],
  speakers: [{ id: "speaker-001", label: "001", path: "s.png", thumbPath: "s.webp", format: "png", width: 1000, height: 2000, bytes: 1 }],
  logos: [{ id: "logo-skku-1", label: "성균관대로고 1", path: "l.svg", thumbPath: "l.svg", format: "svg", width: 1080, height: 1080, bytes: 1 }],
};

// The Presentation's one card size, and the names the page-folder sync reads
assert.deepEqual(
  CONFERENCE_PRESETS.map((preset) => `${preset.id} ${preset.width}x${preset.height}`),
  ["conf-slide 3840x2160"],
);
assert.equal(conferencePresetById("nope").id, "conf-slide");
assert.equal(backgroundIdFor("Insta_1x1_2160x2160.mp4"), "instagram");
assert.equal(backgroundIdFor("x_banner_1x3_1280×3840.mp4"), "banner-x");
assert.equal(backgroundIdFor("L_banner_6x1_5400x900mm_100dpi.png"), "banner-l");
assert.equal(backgroundIdFor("Slide_16x9_3840x2160_compressed.mp4"), "slide");
assert.equal(backgroundIdFor("readme.txt"), null);
assert.equal(logoSlug("홍익대학교 로고-01.svg"), "logo-hongik-1");
assert.equal(logoSlug("성균관대로고 3.svg".normalize("NFD")), "logo-skku-3");
assert.equal(logoSlug("브루넬한인회로고.svg"), "logo-brunel-korean-society");
assert.equal(logoSlug("브루넬로고2.svg"), "logo-brunel-2");
assert.equal(logoSlug("qr코드-01.svg"), "qr-code-1");
assert.equal(logoSlug("모르는파일.svg"), null);
assert.equal(speakerSlug("001.png"), "speaker-001");
assert.equal(conferenceSrc({ id: "speaker-001" }), "conf:speaker-001");

// Video sizes (동영상 on a page with a video background): card size first, then 1920 on the same ratio, both even
assert.deepEqual(videoExportSizes("conf-slide", 3840, 2160), [{ width: 3840, height: 2160 }, { width: 1920, height: 1080 }]);
assert.ok(videoExportSizes("conf-slide", 1001, 563).every((size) => size.width % 2 === 0 && size.height % 2 === 0));

// A saved Slide keeps its conference background and a tinted logo
const state = createTypedPage(1, index, "dark").state;
assert.deepEqual(state.background, { id: "slide", mode: "image" });
const tinted = structuredClone(state);
tinted.layers.push({ id: "logo", kind: "image", src: "conf:logo-skku-1", x: 0, y: 0, width: 200, radius: 0, crop: null, tint: "#ffffff" });
const restored = normalizeStudioState(JSON.parse(JSON.stringify(tinted)));
assert.deepEqual(restored?.background, { id: "slide", mode: "image" });
assert.equal((restored?.layers.find((layer) => layer.id === "logo") as { tint?: string } | undefined)?.tint, "#ffffff");
assert.ok(designToCode(state, () => 2).includes('<img class="studio-bg" src="{{image:background}}"'));
assert.ok(designToCode({ ...state, background: { id: "slide", mode: "video" } }, () => 2).includes("<video class=\"studio-bg\""));

// Route: the Presentation opens one project; the original tabs are gone
assert.deepEqual(parseHash("#/presentation"), { name: "presentation", project: null });
assert.deepEqual(parseHash("#/presentation/project-1"), { name: "presentation", project: "project-1" });
assert.equal(hrefFor({ name: "presentation", project: null }), "#/presentation");
assert.equal(hrefFor({ name: "presentation", project: "project-1" }), "#/presentation/project-1");
assert.equal(parseHash("#/conference").name, "notfound");

// The working deck of one project in this browser
const savePresentationDeck = (deck: PresentationDeck) => saveDeck("project-1", deck, null);
const loadPresentationDeck = (conference: ConferenceIndex) => loadDeck("project-1", null, () => createPresentationDeck(conference));
const deck = createPresentationDeck(index);
assert.equal(deck.pages.length, 10);
assert.equal(deck.pages[0]?.type, 2);
assert.equal(deck.pages[0]?.role, "content");
assert.equal(deck.pages[0]?.state.cardWidth, 3840);
assert.equal(deck.pages[0]?.state.cardHeight, 2160);
assert.equal(deck.pages[0]?.state.background ?? null, null);
assert.equal(deck.pages[1]?.type, 2);
assert.equal(deck.pages[1]?.state.background ?? null, null);
assert.equal(deck.pages[3]?.type, 1);
assert.equal(deck.pages[3]?.role, "divider");
assert.deepEqual(deck.pages[3]?.state.background, { id: "slide", mode: "image" });
assert.equal(deck.pages[4]?.type, 3);
assert.equal(deck.pages[4]?.state.layers.filter((layer) => layer.kind === "image").length, 3);
assert.equal(deck.pages[8]?.type, 1);
assert.equal(deck.pages[8]?.role, "divider");
assert.equal(deck.pages[9]?.type, 3);
assert.equal(deck.pages[9]?.role, "content");
savePresentationDeck(deck);
const loaded = loadPresentationDeck(index);
const titleText = (pages: typeof deck.pages, at: number) => {
  const layer = pages[at]?.state.layers.find((item) => item.kind === "title");
  return layer?.kind === "title" ? layer.text : "";
};
assert.equal(titleText(loaded.pages, 4), titleText(deck.pages, 4));
assert.equal(titleText(loaded.pages, 1), "AI");
assert.equal(titleText(loaded.pages, 3), "");
const bodyText = (pages: typeof deck.pages, at: number) => {
  const layer = pages[at]?.state.layers.find((item) => item.kind === "body");
  return layer?.kind === "body" ? layer.text : "";
};
assert.equal(bodyText(loaded.pages, 1), "");
assert.equal(titleText(deck.pages, 0), "생성형 AI에서 에이전틱 AI, 그리고 AX까지: UX 디자인 프로세스의 확장");
assert.equal(titleText(deck.pages, 1), "AI");
assert.equal(titleText(deck.pages, 4), "TODAY\u2019s AGENDA");
assert.equal(titleText(deck.pages, 8), "WE ARE IN THE AI ARA");
const titleSize = (at: number) => {
  const layer = deck.pages[at]?.state.layers.find((item) => item.kind === "title");
  return layer?.kind === "title" ? layer.size : 0;
};
assert.equal(titleSize(0), 128);
assert.equal(titleSize(1), 400);
assert.equal(titleSize(4), 200);
syncPresentationMode(deck, "light");
assert.equal(deck.pages[3]?.tone, null);
assert.equal(deck.pages[3]?.state.color, bareCardColor("light"));
assert.ok(deck.pages.filter((page) => page.type !== 1).every((page) => page.tone === "light"));
const lightTitle = deck.pages[0]?.state.layers.find((layer) => layer.kind === "title");
assert.equal(lightTitle?.kind === "title" ? lightTitle.color : "", rgbToHex(0, 28, 51));
syncPresentationMode(deck, "dark");
assert.ok(deck.pages.filter((page) => page.type !== 1).every((page) => page.tone === "dark"));
assert.equal(deck.pages[3]?.tone, null);
assert.equal(deck.pages[3]?.state.color, bareCardColor("dark"));
assert.equal(reorderPresentationPage(deck, 0, 0), false);
assert.equal(reorderPresentationPage(deck, 0, 1), false);
assert.equal(reorderPresentationPage(deck, 0, 3), true);
assert.equal(deck.selected, 2);
assert.equal(titleText(deck.pages, 0), "AI");
assert.equal(titleText(deck.pages, 2), "생성형 AI에서 에이전틱 AI, 그리고 AX까지: UX 디자인 프로세스의 확장");
savePresentationDeck(deck);
const reordered = loadPresentationDeck(index);
assert.equal(reordered.selected, 2);
assert.equal(titleText(reordered.pages, 0), "AI");
assert.equal(titleText(reordered.pages, 2), "생성형 AI에서 에이전틱 AI, 그리고 AX까지: UX 디자인 프로세스의 확장");
assert.equal(reordered.pages.map((page) => page.id).join(","), deck.pages.map((page) => page.id).join(","));
const blankDark = createBlankPage("dark");
const blankLight = createBlankPage("light");
assert.equal(blankDark.state.color, bareCardColor("dark"));
assert.equal(blankLight.state.color, bareCardColor("light"));
assert.equal(blankDark.state.layers.length, 0);
assert.equal(blankDark.state.background, undefined);
assert.equal(cardIsBare(blankDark.state), true);
assert.equal(cardIsBare(blankLight.state), true);
assert.notEqual(blankDark.id, blankLight.id);
const type1 = createTypedPage(1, index, "dark");
assert.equal(type1.type, 1);
assert.equal(type1.tone, null);
assert.equal(type1.state.color, rgbToHex(1, 1, 2));
assert.equal(type1.state.background?.id, "slide");
assert.equal(titleText([type1], 0), "WE ARE IN THE AI ARA");
const type1Title = type1.state.layers.find((layer) => layer.kind === "title");
assert.equal(type1Title?.kind === "title" ? type1Title.align : "", "center");
assert.notEqual(type1.id, createTypedPage(1, index, "light").id);
const typed = createTypedPage(2, index, "dark");
assert.equal(typed.type, 2);
assert.notEqual(typed.id, "page-01");
assert.equal(titleText([typed], 0), "생성형 AI에서 에이전틱 AI, 그리고 AX까지: UX 디자인 프로세스의 확장");
const copied = duplicatePresentationPage(deck.pages[0]);
assert.notEqual(copied.id, deck.pages[0]?.id);
assert.equal(titleText([copied], 0), titleText(deck.pages, 0));
insertPresentationPage(deck, 0, typed);
assert.equal(deck.selected, 1);
assert.equal(deck.pages[1]?.id, typed.id);
savePresentationDeck(deck);
const extended = loadPresentationDeck(index);
assert.equal(extended.pages.length, deck.pages.length);
assert.equal(extended.pages[1]?.id, typed.id);
assert.equal(extended.selected, 1);
assert.equal(extended.pages[0]?.name, "");
deck.pages[0].name = "Opening";
savePresentationDeck(deck);
const named = loadPresentationDeck(index);
assert.equal(named.pages[0]?.name, "Opening");
assert.equal(named.pages[1]?.name, "");
const beforeRemove = deck.pages.length;
assert.equal(removePresentationPage(deck, 1), true);
assert.equal(deck.pages.length, beforeRemove - 1);
assert.notEqual(deck.pages[1]?.id, typed.id);
assert.equal(deck.selected, 1);
assert.equal(removePresentationPage(deck, deck.pages.length - 1), true);
assert.equal(deck.selected, deck.pages.length - 1);
assert.equal(removePresentationPage({ selected: 0, pages: [typed] }, 0), false);

// Page ranges move and delete as one block in deck order
const ranged = createPresentationDeck(index);
const ids = ranged.pages.map((page) => page.id);
ranged.selected = 2;
assert.equal(movePresentationPages(ranged, [1, 2, 3], 1), false);
assert.equal(movePresentationPages(ranged, [1, 2, 3], 4), false);
assert.equal(movePresentationPages(ranged, [3, 1, 2], 7), true);
assert.deepEqual(ranged.pages.map((page) => page.id), [ids[0], ids[4], ids[5], ids[6], ids[1], ids[2], ids[3], ids[7], ids[8], ids[9]]);
assert.equal(ranged.pages[ranged.selected]?.id, ids[2]);
assert.equal(movePresentationPages(ranged, [4, 5, 6], 0), true);
assert.deepEqual(ranged.pages.slice(0, 4).map((page) => page.id), [ids[1], ids[2], ids[3], ids[0]]);
assert.equal(removePresentationPages(ranged, [0, 1, 2]), true);
assert.equal(ranged.pages.length, 7);
assert.equal(ranged.pages[ranged.selected]?.id, ids[0]);
assert.equal(removePresentationPages(ranged, ranged.pages.map((_, at) => at)), false);

// Default pages: one page replaces its twin by id, or lands after its nearest earlier neighbour
const projectDefaults = deckDefaults(PROJECT_1_DECK.pages);
const basePages = () => defaultPresentationDeck(projectDefaults)!.pages;
const fresh = defaultPresentationDeck(projectDefaults)!;
const defaultCount = fresh.pages.length;
assert.ok(defaultCount >= 1);
fresh.pages[1].name = "Edited";
assert.equal(defaultsWithPage(fresh, 1, basePages())[1]?.name, "Edited");
assert.equal(defaultsWithPage(fresh, 1, basePages()).length, defaultCount);
const added = createTypedPage(3, index, "dark");
insertPresentationPage(fresh, 2, added);
const merged = defaultsWithPage(fresh, 3, basePages());
assert.equal(merged.length, defaultCount + 1);
assert.equal(merged[3]?.id, added.id);
assert.equal(merged[2]?.id, fresh.pages[2]?.id);

// An empty page keeps no invented layers, and its floor follows the mode without recoloring pages that still have content.
const emptied = normalizeStudioState({
  themeSlug: "x",
  color: rgbToHex(16, 42, 74),
  cardWidth: 3840,
  cardHeight: 2160,
  layers: [],
  background: { id: "slide", mode: "image" },
});
assert.ok(emptied);
assert.equal(emptied.layers.length, 0);
assert.equal(emptied.background?.id, "slide");
assert.equal(cardIsBare(emptied), false);
delete emptied.background;
assert.equal(cardIsBare(emptied), true);
const ghost = normalizeStudioState({
  themeSlug: "x",
  color: rgbToHex(16, 42, 74),
  layers: [
    { id: "image", kind: "image", src: "", x: 0, y: 0, width: 100, opacity: 0 },
    { id: "body", kind: "body", text: "  ", x: 0, y: 0, size: 32, fontId: "pretendard", color: rgbToHex(0, 0, 0) },
  ],
});
assert.equal(cardIsBare(ghost!), true);
const titled = normalizeStudioState({
  themeSlug: "x",
  color: rgbToHex(16, 42, 74),
  layers: [{ id: "t", kind: "title", text: "A", x: 0, y: 0, size: 32, fontId: "pretendard", color: rgbToHex(0, 0, 0) }],
});
assert.equal(cardIsBare(titled!), false);
assert.equal(bareCardColor("dark"), rgbToHex(1, 1, 2));
assert.equal(bareCardColor("light"), rgbToHex(252, 252, 255));
const bareDeck = createPresentationDeck(index);
const barePage = bareDeck.pages[3];
assert.ok(barePage);
barePage.state.layers = [];
delete barePage.state.background;
barePage.state.color = rgbToHex(16, 42, 74);
barePage.type = 2;
barePage.tone = "dark";
syncPresentationMode(bareDeck, "light");
assert.equal(barePage.state.color, rgbToHex(16, 42, 74));
const keptColor = bareDeck.pages[0]?.state.color;
assert.notEqual(keptColor, bareCardColor("light"));
assert.equal(recolorBarePages(bareDeck, "dark"), true);
assert.equal(barePage.state.color, bareCardColor("dark"));
assert.equal(bareDeck.pages[0]?.state.color, keptColor);
assert.equal(recolorBarePages(bareDeck, "dark"), false);
assert.equal(recolorBarePages(bareDeck, "light"), true);
assert.equal(barePage.state.color, bareCardColor("light"));
assert.equal(bareDeck.pages[0]?.state.color, keptColor);

console.log("OK: Slide preset, slugs, video sizes, saved slide, routes, and the deck model");
