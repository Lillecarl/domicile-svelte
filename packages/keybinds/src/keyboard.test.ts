import { describe, expect, test } from "bun:test";

import { capOf, KEYBOARD } from "./keyboard";

describe("KEYBOARD", () => {
  test("draws every row below the top one 15 keys wide, so the rows line up", () => {
    expect(KEYBOARD.map((keys) => keys.reduce((sum, { width = 1 }) => sum + width, 0))).toEqual([
      4.5, 15, 15, 15, 15, 15,
    ]);
  });

  test("names each character key by the keysym a chord uses", () => {
    expect(KEYBOARD.flat().map(({ key }) => key)).toContain("bracketleft");
  });
});

describe("capOf", () => {
  test("prints a modifier key's name rather than its keysym", () => {
    expect(capOf("Super_L", (key) => key)).toBe("Meta");
  });
});
