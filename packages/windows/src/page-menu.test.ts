import { expect, test } from "bun:test";

import { pageMenu } from "./page-menu";

const ran: string[] = [];
const click = {
  canCopy: false,
  canCut: false,
  canDelete: false,
  canPaste: true,
  canPictureInPicture: false,
  canRedo: false,
  canSelectAll: true,
  canUndo: false,
  hasImageContents: false,
  inPictureInPicture: false,
  isEditable: false,
  linkUrl: "",
  mediaType: "none",
  misspelledWord: "",
  replaceMisspelling: (word: string) => ran.push(`replace ${word}`),
  run: (action: string) => ran.push(action),
  selectionText: "",
  spellingSuggestions: [] as string[],
  srcUrl: "",
};
const page = {
  canGoBack: true,
  canGoForward: false,
  back: () => ran.push("back"),
  forward: () => ran.push("forward"),
  reload: () => ran.push("reload"),
  open: (url: string) => ran.push(`open ${url}`),
};
const labels = (menu: ReturnType<typeof pageMenu>) =>
  menu.map((entry) => (entry.kind === "separator" ? "-" : entry.label));

test("a page has its own history and Inspect", () => {
  expect(labels(pageMenu(click, page, []))).toEqual(["Back", "Forward", "Reload", "-", "Inspect"]);
});

test("a link and a picture have their own commands, and no history", () => {
  const menu = pageMenu(
    { ...click, linkUrl: "https://a.example/", mediaType: "image", hasImageContents: true, srcUrl: "https://a.example/p" },
    page,
    [],
  );
  expect(labels(menu)).toEqual([
    "Open link in new window",
    "Save link as…",
    "Copy link address",
    "-",
    "Open image in new window",
    "Save image as…",
    "Copy image",
    "Copy image address",
    "-",
    "Inspect",
  ]);
});

test("a field has the edit commands, as the page allows them", () => {
  const menu = pageMenu({ ...click, isEditable: true, misspelledWord: "teh", spellingSuggestions: ["the"] }, page, []);
  expect(labels(menu).slice(0, 5)).toEqual(["the", "Add to dictionary", "-", "Undo", "Redo"]);
  const enabled = menu.flatMap((entry) => (entry.kind === "item" && entry.enabled ? [entry.label] : []));
  expect(enabled).toContain("Paste");
  expect(enabled).not.toContain("Cut");
});

test("a selection is searched for, cut short in the label", () => {
  const menu = pageMenu({ ...click, selectionText: `a\n${"b".repeat(60)}` }, page, []);
  const search = menu.find((entry) => entry.kind === "item" && entry.label.startsWith("Search"));
  expect(search?.kind === "item" && search.label).toBe(`Search for “a ${"b".repeat(38)}…”`);
});

test("extensions' items come before Inspect, with keys of their own", () => {
  const menu = pageMenu(click, page, [{ kind: "item", key: "Reload", label: "Bitwarden", enabled: true }]);
  expect(labels(menu).slice(-4)).toEqual(["-", "Bitwarden", "-", "Inspect"]);
  expect(new Set(menu.map(({ key }) => key)).size).toBe(menu.length);
});
