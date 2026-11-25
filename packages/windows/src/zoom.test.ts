import { expect, test } from "bun:test";

import { zoomedIn, zoomedOut } from "./zoom";

test("zoom goes by Chrome's steps, from a factor that is not exact", () => {
  expect(zoomedIn(1)).toBe(1.1);
  expect(zoomedIn(1.0999)).toBe(1.25);
  expect(zoomedOut(1.1001)).toBe(1);
  expect(zoomedOut(1.05)).toBe(1);
});

test("zoom stops at its ends", () => {
  expect(zoomedIn(5)).toBe(5);
  expect(zoomedOut(0.25)).toBe(0.25);
});
