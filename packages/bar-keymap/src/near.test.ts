import { describe, expect, test } from "bun:test";

import { near } from "./near";

const label = { height: 30, width: 60 };
const page = { height: 1080, width: 1920 };

describe("near", () => {
  test("puts the label below and right of the pointer", () => {
    expect(near({ x: 100, y: 200 }, label, page)).toEqual({ x: 116, y: 216 });
  });

  test("keeps the label inside the page at its bottom right corner", () => {
    expect(near({ x: 1919, y: 1079 }, label, page)).toEqual({ x: 1852, y: 1042 });
  });

  test("keeps a label wider than the page at its left edge", () => {
    expect(near({ x: 10, y: 10 }, { height: 30, width: 2000 }, page)).toEqual({ x: 8, y: 26 });
  });
});
