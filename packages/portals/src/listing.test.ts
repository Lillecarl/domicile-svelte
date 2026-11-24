import { describe, expect, test } from "bun:test";

import { accepts, joined, listed, parentOf, placeOf, savable } from "./listing";

const entries = [
  { name: "b.txt", folder: false },
  { name: "a10.png", folder: false },
  { name: "a9.PNG", folder: false },
  { name: ".hidden", folder: false },
  { name: "zoo", folder: true },
];
const names = (options: Partial<Parameters<typeof listed>[1]>) =>
  listed(entries, { query: "", filter: undefined, foldersOnly: false, ...options }).map(({ name }) => name);

describe("paths", () => {
  test("join and go up, at the root too", () => {
    expect(joined("/home", "a")).toBe("/home/a");
    expect(joined("/", "a")).toBe("/a");
    expect(parentOf("/home/me")).toBe("/home");
    expect(parentOf("/home")).toBe("/");
    expect(parentOf("/")).toBe("/");
  });

  test("typed text with a slash is a path, its last part a search", () => {
    const place = (text: string) => placeOf(text, "/srv/data", "/home/me");
    expect(place("report")).toEqual({ folder: "/srv/data", query: "report" });
    expect(place("~")).toEqual({ folder: "/home/me", query: "" });
    expect(place("~/")).toEqual({ folder: "/home/me", query: "" });
    expect(place("~/Code/cr")).toEqual({ folder: "/home/me/Code", query: "cr" });
    expect(place("/")).toEqual({ folder: "/", query: "" });
    expect(place("/etc//../tmp/")).toEqual({ folder: "/tmp", query: "" });
    expect(place("..")).toEqual({ folder: "/srv", query: "" });
    expect(place("sub/x")).toEqual({ folder: "/srv/data/sub", query: "x" });
  });
});

describe("listed", () => {
  test("folders first, names in numeric order, no dotfiles", () => {
    expect(names({})).toEqual(["zoo", "a9.PNG", "a10.png", "b.txt"]);
  });

  test("a query with a dot shows dotfiles", () => {
    expect(names({ query: ".h" })).toEqual([".hidden"]);
  });

  test("a filter keeps folders", () => {
    expect(names({ filter: { extensions: ["png"] } })).toEqual(["zoo", "a9.PNG", "a10.png"]);
  });

  test("a folder chooser lists folders alone", () => {
    expect(names({ foldersOnly: true })).toEqual(["zoo"]);
  });
});

test("a filter with no extensions accepts any file", () => {
  expect(accepts({ extensions: [] }, "x")).toBe(true);
  expect(accepts({ extensions: ["tar.gz"] }, "x.tar.gz")).toBe(true);
  expect(accepts({ extensions: ["gz"] }, "gz")).toBe(false);
});

test("a name to save under has no slash", () => {
  expect(savable("a.txt")).toBe(true);
  expect(["", ".", "..", "a/b"].some(savable)).toBe(false);
});
