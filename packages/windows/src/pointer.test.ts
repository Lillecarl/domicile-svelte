import { expect, test } from "bun:test";
import type { ClientWindow } from "@domicile-desktop/sdk/desktop/windows";

import { confinedTo, confineFor, lockFor } from "./pointer";

const list = [
  { appId: "game", pointerConstraint: "lock" },
  { appId: "viewer", pointerConstraint: "confine" },
  { appId: "term" },
] as ClientWindow[];

test("only the focused window holds the pointer", () => {
  expect(lockFor(list, "game")).toBe("game");
  expect(lockFor(list, "viewer")).toBeUndefined();
  expect(lockFor(list, undefined)).toBeUndefined();
  expect(confineFor(list, "viewer")?.appId).toBe("viewer");
  expect(confineFor(list, "term")).toBeUndefined();
});

const at = { x: 100, y: 50, width: 800, height: 600 };

test("a window with no region keeps the pointer anywhere in it", () => {
  expect(confinedTo({ width: 400, height: 300, pointerRegion: undefined }, at)).toEqual([at]);
  expect(confinedTo({ width: 400, height: 300, pointerRegion: undefined }, { ...at, width: 0 })).toEqual([]);
});

test("a region is scaled to the window as drawn, and cut to it", () => {
  const region = (x: number, y: number, width: number, height: number) => [{ x, y, width, height }];
  expect(confinedTo({ width: 400, height: 300, pointerRegion: region(10, 10, 100, 100) }, at)).toEqual([
    { x: 120, y: 70, width: 200, height: 200 },
  ]);
  expect(confinedTo({ width: 400, height: 300, pointerRegion: region(350, 0, 100, 10) }, at)).toEqual([
    { x: 800, y: 50, width: 100, height: 20 },
  ]);
  expect(confinedTo({ width: 400, height: 300, pointerRegion: region(500, 0, 10, 10) }, at)).toEqual([]);
});
