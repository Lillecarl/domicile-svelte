import { expect, test } from "bun:test";

import {
  addMonths,
  day,
  format,
  formatTime,
  parse,
  parseHex,
  timeParts,
  toHex,
  toHsv,
  weekOf,
  weeksOf,
  within,
} from "./calendar";

test("values read and write back", () => {
  for (const [kind, value] of [
    ["date", "2026-11-06"],
    ["month", "2026-11"],
    ["week", "2026-W45"],
    ["week", "2026-W53"],
    ["datetime-local", "2026-02-28T13:45"],
  ] as const) {
    const of = parse(kind, value);
    expect(of === undefined ? undefined : format(kind, of, "13:45")).toBe(value);
  }
});

test("what names no day is none", () => {
  for (const [kind, value] of [
    ["date", ""],
    ["date", "2026-02-30"],
    ["month", "2026-13"],
    ["week", "2025-W53"],
  ] as const) {
    expect(parse(kind, value)).toBeUndefined();
  }
});

test("a week may belong to the year before", () => {
  expect(weekOf(day(2027, 1, 1))).toEqual({ year: 2026, week: 53 });
});

test("a month is whole weeks from Monday", () => {
  const weeks = weeksOf(day(2026, 11, 6));
  expect(weeks.length).toBe(6);
  expect(format("date", weeks[0]?.[0] ?? day(1, 1, 1), "")).toBe("2026-10-26");
  expect(format("date", weeks[5]?.[6] ?? day(1, 1, 1), "")).toBe("2026-12-06");
  expect(weeksOf(day(2027, 2, 1)).length).toBe(4);
});

test("a month later is never past its end", () => {
  expect(format("date", addMonths(day(2026, 1, 31), 1), "")).toBe("2026-02-28");
  expect(format("date", addMonths(day(2026, 1, 31), -2), "")).toBe("2025-11-30");
});

test("bounds hold, and an unreadable one does not", () => {
  expect(within("date", day(2026, 1, 2), "2026-01-03", "")).toBe(false);
  expect(within("date", day(2026, 1, 3), "2026-01-03", "x")).toBe(true);
});

test("times, with seconds where they have them", () => {
  expect(timeParts("2026-01-01T09:05")).toEqual([9, 5]);
  expect(timeParts("09:05:07")).toEqual([9, 5, 7]);
  expect(formatTime([9, 5, 7])).toBe("09:05:07");
  expect(timeParts("")).toEqual([12, 0]);
});

test("colors read and write back", () => {
  for (const hex of ["#000000", "#ffffff", "#1971c2", "#ff0080", "#808080"]) {
    expect(toHex(toHsv(hex))).toBe(hex);
  }
  expect(parseHex(" 1971C2 ")).toBe("#1971c2");
  expect(parseHex("red")).toBeUndefined();
});
