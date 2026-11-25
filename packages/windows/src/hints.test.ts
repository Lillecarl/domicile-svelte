import { expect, test } from "bun:test";

import { tipPlace } from "./hints";

const tip = { width: 100, height: 20 };
const page = { width: 800, height: 600 };

test("a tooltip is under the pointer", () => {
  expect(tipPlace({ x: 10, y: 10 }, tip, page)).toEqual({ left: 10, top: 30 });
});

test("a tooltip stays inside its page", () => {
  expect(tipPlace({ x: 790, y: 590 }, tip, page)).toEqual({ left: 700, top: 566 });
  expect(tipPlace({ x: 10, y: 10 }, tip, { width: 50, height: 20 })).toEqual({ left: 0, top: 0 });
});
