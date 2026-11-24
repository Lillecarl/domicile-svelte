import { expect, test } from "bun:test";

import { popupsOf } from "./popups";

const window = (appId: string, parent?: string, x?: number, y?: number) => ({
  appId,
  parent,
  x,
  y,
});
const list = [
  window("firefox"),
  window("menu", "firefox", 10, 20),
  window("kitty"),
  window("submenu", "menu", 100, 5),
  window("tooltip", "kitty", 1, 2),
  window("orphan", "gone", 1, 2),
  window("loop-a", "loop-b", 1, 1),
  window("loop-b", "loop-a", 1, 1),
];

test("a menu and its submenu are placed from their window's corner", () => {
  expect(popupsOf(list, "firefox").map(({ window: { appId }, x, y }) => [appId, x, y])).toEqual([
    ["menu", 10, 20],
    ["submenu", 110, 25],
  ]);
});

test("a window has only its own popups, and one with no window has none", () => {
  expect(popupsOf(list, "kitty").map(({ window: { appId } }) => appId)).toEqual(["tooltip"]);
  expect(popupsOf(list, "none")).toEqual([]);
});
