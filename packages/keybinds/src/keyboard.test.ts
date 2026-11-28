import { describe, expect, test } from "bun:test";

import { capOf, keyboardFor, keysymOf, US_LAYOUT } from "./keyboard";

const widths = (iso: boolean) => keyboardFor(iso).map((keys) => keys.reduce((sum, { width = 1 }) => sum + width, 0));

// What a Swedish layout's map says, for the keys that differ from US.
const SWEDISH = new Map([
  ...US_LAYOUT,
  ["BracketLeft", "å"],
  ["Semicolon", "ö"],
  ["Quote", "ä"],
  ["Minus", "+"],
  ["IntlBackslash", "<"],
]);

const key = (code: string) => ({ code });

describe("keyboardFor", () => {
  test("draws every row below the top one 15 keys wide, in both shapes", () => {
    expect(widths(false)).toEqual([4.5, 15, 15, 15, 15, 15]);
    expect(widths(true)).toEqual([4.5, 15, 15, 15, 15, 15]);
  });

  test("has the key beside left Shift only in the ISO shape", () => {
    const codes = (iso: boolean) =>
      keyboardFor(iso)
        .flat()
        .map(({ code }) => code);
    expect(codes(true)).toContain("IntlBackslash");
    expect(codes(false)).not.toContain("IntlBackslash");
  });
});

describe("keysymOf", () => {
  test("names a key by what the layout types on it", () => {
    expect(keysymOf(key("BracketLeft"), US_LAYOUT)).toBe("bracketleft");
    expect(keysymOf(key("BracketLeft"), SWEDISH)).toBe("aring");
    expect(keysymOf(key("KeyQ"), SWEDISH)).toBe("q");
  });

  test("names a key that types nothing by its own keysym", () => {
    expect(keysymOf({ code: "Enter", keysym: "Return" }, SWEDISH)).toBe("Return");
  });

  test("names no keysym for a key the layout leaves out", () => {
    expect(keysymOf(key("IntlBackslash"), US_LAYOUT)).toBeUndefined();
  });
});

describe("capOf", () => {
  test("prints what the layout types, or the key's name", () => {
    expect(capOf(key("Quote"), SWEDISH)).toBe("Ä");
    expect(capOf(key("MetaLeft"), SWEDISH)).toBe("Meta");
  });
});
