import { expect, test } from "bun:test";

import { columnOfWidth } from "./columns";
import { type Page, parseSession, renamed, restored, savedOf, sessionOf, sleeperOf } from "./session";

const page = (url: string, more: Partial<Page> = {}): Page => ({
  url,
  title: url,
  profile: "personal",
  isApp: false,
  appId: "",
  isPrivate: false,
  partition: "",
  width: 0,
  height: 0,
  ...more,
});
const saved = (url: string, more: Partial<Page> = {}) => {
  const it = savedOf(page(url, more));
  if (it === undefined) {
    throw new Error(`${url} is not saved`);
  }
  return it;
};
const A = "https://a.example/";
const B = "https://b.example/";
const slack = { isApp: true, appId: "slack", profile: "work" };

test("private pages, popups and pages that open nothing again are not saved", () => {
  expect(savedOf(page(A))).toBeDefined();
  for (const more of [{ isPrivate: true }, { partition: "x" }, { popupWindow: 1 }, { width: 300 }]) {
    expect(savedOf(page(A, more))).toBeUndefined();
  }
  expect(savedOf(page(A, { profile: undefined }))).toBeUndefined();
  for (const url of ["", "about:blank", "blob:https://a.example/1", "domicile://shell/"]) {
    expect(savedOf(page(url))).toBeUndefined();
  }
});

const session = sessionOf(
  [
    { ...saved(A), key: "browser:1" },
    { ...saved(B), key: "browser:2" },
    { ...saved(B, slack), key: "browser:3" },
  ],
  [columnOfWidth(["kitty", "browser:2"], 0.5), columnOfWidth(["kitty-2"], 0.5), columnOfWidth(["browser:1"], 0.3)],
  ["browser:3"],
);

test("a session has its pages' columns, without native windows", () => {
  expect(session.columns.map(({ windows }) => windows)).toEqual([[1], [0]]);
  expect(session.parked).toEqual([2]);
  expect(parseSession(JSON.stringify(session))).toEqual(session);
});

test("text that is no session is none", () => {
  for (const text of [null, "", "{", "[]", "{}", JSON.stringify({ ...session, parked: [9] })]) {
    expect(parseSession(text)).toBeUndefined();
  }
});

test("on an empty desk every page sleeps in its place", () => {
  const { asleep, columns, parked } = restored(session, []);
  expect(asleep.map(({ key, url }) => [key, url])).toEqual([
    ["asleep:0", A],
    ["asleep:1", B],
    ["asleep:2", B],
  ]);
  expect(columns).toEqual([columnOfWidth(["asleep:1"], 0.5), columnOfWidth(["asleep:0"], 0.3)]);
  expect(parked).toEqual(["asleep:2"]);
});

test("after a shell reload open windows keep their keys and places", () => {
  const { asleep, columns, parked } = restored(session, [
    { key: "browser:7", page: saved(A) },
    // An app is the same one wherever it has gone.
    { key: "browser:8", page: saved("https://b.example/elsewhere", slack) },
  ]);
  expect(asleep.map(({ key }) => key)).toEqual(["asleep:1"]);
  expect(columns.map(({ windows }) => windows)).toEqual([["asleep:1"], ["browser:7"]]);
  expect(parked).toEqual(["browser:8"]);
});

test("two windows of one address take one page each", () => {
  const twice = sessionOf(
    [
      { ...saved(A), key: "1" },
      { ...saved(A), key: "2" },
    ],
    [],
    [],
  );
  const { asleep } = restored(twice, [{ key: "browser:1", page: saved(A) }]);
  expect(asleep.map(({ key }) => key)).toEqual(["asleep:1"]);
});

test("a page in another profile is another page", () => {
  expect(sleeperOf([saved(A)], saved(A, { profile: "work" }))).toBeUndefined();
  expect(sleeperOf([saved(A)], saved(B))).toBeUndefined();
  expect(sleeperOf([saved(A)], saved(A))).toBeDefined();
});

test("a woken page takes its sleeper's place", () => {
  const columns = [columnOfWidth(["x", "asleep:0"], 0.5), columnOfWidth(["browser:1"], 0.3)];
  expect(renamed(columns, "asleep:0", "browser:1")).toEqual([columnOfWidth(["x", "browser:1"], 0.5)]);
  expect(renamed(columns, "gone", "browser:1")).toEqual(columns);
});
