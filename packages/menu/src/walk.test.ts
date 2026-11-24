import { expect, test } from "bun:test";

import { beside, type Entry, fitted, levels, stepped } from "./walk";

const item = (key: string, more: { enabled?: boolean; submenu?: Entry[] } = {}): Entry => ({
  kind: "item",
  key,
  label: key,
  enabled: true,
  ...more,
});
const menu: Entry[] = [
  item("a"),
  { kind: "separator", key: "s" },
  item("b", { enabled: false }),
  item("c", { submenu: [item("d", { submenu: [item("e")] })] }),
];
const keys = (open: string[]) => levels(menu, open).map((level) => level.map(({ key }) => key));

test("levels follow the open submenus", () => {
  expect(keys([])).toEqual([["a", "s", "b", "c"]]);
  expect(keys(["c", "d"])).toEqual([["a", "s", "b", "c"], ["d"], ["e"]]);
});

test("a submenu that is gone closes", () => {
  expect(keys(["gone", "d"])).toEqual([["a", "s", "b", "c"]]);
  expect(keys(["c", "gone"])).toEqual([["a", "s", "b", "c"], ["d"]]);
});

test("stepping skips separators and disabled items, and wraps", () => {
  expect(stepped(menu, undefined, 1)).toBe("a");
  expect(stepped(menu, undefined, -1)).toBe("c");
  expect(stepped(menu, "a", 1)).toBe("c");
  expect(stepped(menu, "c", 1)).toBe("a");
  expect(stepped(menu, "a", -1)).toBe("c");
  expect(stepped([], undefined, 1)).toBeUndefined();
});

test("a menu stays on the screen", () => {
  expect(fitted(950, 100, 1000)).toBe(900);
  expect(fitted(10, 2000, 1000)).toBe(0);
  expect(beside({ left: 100, right: 200 }, 100, 1000)).toBe(200);
  expect(beside({ left: 850, right: 990 }, 100, 1000)).toBe(750);
});
