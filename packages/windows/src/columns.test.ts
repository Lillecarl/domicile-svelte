import { describe, expect, test } from "bun:test";

import {
  type Columns,
  center,
  consume,
  consumeOrExpel,
  edge,
  expel,
  filled,
  moveColumn,
  moveWindow,
  neighbor,
  nextPreset,
  place,
  scrollTo,
  spans,
  sync,
  toggleFull,
} from "./columns";

const HALF = 0.5;
// Columns of half width, from their windows.
const of = (...stacks: string[][]): Columns => stacks.map((windows) => ({ windows, width: HALF, full: false }));
const windowsOf = (columns: Columns) => columns.map((column) => column.windows);

describe("place", () => {
  test("puts columns side by side at their widths and splits a column's height", () => {
    const columns: Columns = [
      { windows: ["a"], width: 0.5, full: false },
      { windows: ["b", "c"], width: 0.25, full: false },
    ];
    const boxes = place(columns, { view: 410, gap: 10, height: 210 });
    expect(boxes.get("a")).toEqual({ x: 0, y: 0, width: 200, height: 210 });
    expect(boxes.get("b")).toEqual({ x: 210, y: 0, width: 100, height: 100 });
    expect(boxes.get("c")).toEqual({ x: 210, y: 110, width: 100, height: 100 });
  });

  test("a maximized column takes the view's whole width", () => {
    const columns = toggleFull(of(["a"], ["b"]), "a");
    expect(spans(columns, { view: 410, gap: 10 })).toEqual([
      { start: 0, end: 410 },
      { start: 420, end: 620 },
    ]);
  });
});

describe("sync", () => {
  test("opens a new window as a column right of the focused one", () => {
    expect(windowsOf(sync(of(["a"], ["b"]), ["a", "b", "c"], "a", HALF))).toEqual([["a"], ["c"], ["b"]]);
  });

  test("appends with nothing focused", () => {
    expect(windowsOf(sync(of(["a"]), ["a", "b"], undefined, HALF))).toEqual([["a"], ["b"]]);
  });

  test("drops closed windows and the columns they empty", () => {
    expect(windowsOf(sync(of(["a", "b"], ["c"]), ["a"], "a", HALF))).toEqual([["a"]]);
  });

  test("keeps a column's width", () => {
    expect(sync(toggleFull(of(["a"]), "a"), ["a"], "a", HALF)[0]?.full).toBe(true);
  });
});

describe("neighbor", () => {
  const columns = of(["a"], ["b", "c"], ["d"]);

  test("moves between columns and keeps the row where it can", () => {
    expect(neighbor(columns, "a", "right")).toBe("b");
    expect(neighbor(columns, "c", "right")).toBe("d");
    expect(neighbor(columns, "c", "left")).toBe("a");
  });

  test("moves within a column", () => {
    expect(neighbor(columns, "b", "down")).toBe("c");
    expect(neighbor(columns, "c", "up")).toBe("b");
  });

  test("stops at the edges", () => {
    expect(neighbor(columns, "a", "left")).toBeUndefined();
    expect(neighbor(columns, "b", "up")).toBeUndefined();
  });

  test("picks the first window when nothing is focused", () => {
    expect(neighbor(columns, undefined, "right")).toBe("a");
  });

  test("edge finds the first and last columns, keeping the row", () => {
    expect(edge(columns, "c", "first")).toBe("a");
    expect(edge(columns, "a", "last")).toBe("d");
  });
});

describe("consume and expel", () => {
  test("a window sharing a column leaves for a column of its own on that side", () => {
    expect(windowsOf(consumeOrExpel(of(["a", "b"]), "b", "left", HALF))).toEqual([["b"], ["a"]]);
    expect(windowsOf(consumeOrExpel(of(["a", "b"]), "a", "right", HALF))).toEqual([["b"], ["a"]]);
  });

  test("a window alone joins the bottom of the column on that side", () => {
    expect(windowsOf(consumeOrExpel(of(["a", "b"], ["c"]), "c", "left", HALF))).toEqual([["a", "b", "c"]]);
    expect(windowsOf(consumeOrExpel(of(["a"], ["b"]), "a", "right", HALF))).toEqual([["b", "a"]]);
  });

  test("a window alone at the edge stays", () => {
    expect(windowsOf(consumeOrExpel(of(["a"], ["b"]), "a", "left", HALF))).toEqual([["a"], ["b"]]);
  });

  test("consume takes the next column's top window", () => {
    expect(windowsOf(consume(of(["a"], ["b", "c"]), "a"))).toEqual([["a", "b"], ["c"]]);
    expect(windowsOf(consume(of(["a"], ["b"]), "a"))).toEqual([["a", "b"]]);
  });

  test("expel moves a window right, and leaves a window alone be", () => {
    expect(windowsOf(expel(of(["a", "b"], ["c"]), "a", HALF))).toEqual([["b"], ["a"], ["c"]]);
    expect(windowsOf(expel(of(["a"], ["b"]), "a", HALF))).toEqual([["a"], ["b"]]);
  });
});

describe("moving", () => {
  test("moves a column one place, or to an end", () => {
    const columns = of(["a"], ["b"], ["c"]);
    expect(windowsOf(moveColumn(columns, "b", "left"))).toEqual([["b"], ["a"], ["c"]]);
    expect(windowsOf(moveColumn(columns, "b", "right"))).toEqual([["a"], ["c"], ["b"]]);
    expect(windowsOf(moveColumn(columns, "c", "first"))).toEqual([["c"], ["a"], ["b"]]);
    expect(windowsOf(moveColumn(columns, "a", "last"))).toEqual([["b"], ["c"], ["a"]]);
    expect(windowsOf(moveColumn(columns, "a", "left"))).toEqual([["a"], ["b"], ["c"]]);
  });

  test("moves a window within its column", () => {
    expect(windowsOf(moveWindow(of(["a", "b"]), "a", "down"))).toEqual([["b", "a"]]);
    expect(windowsOf(moveWindow(of(["a", "b"]), "a", "up"))).toEqual([["a", "b"]]);
  });
});

describe("widths", () => {
  const presets = [1 / 3, 1 / 2, 2 / 3];

  test("cycles through the presets, wider first, then around", () => {
    const half = of(["a"]);
    const twoThirds = nextPreset(half, "a", presets);
    expect(twoThirds[0]?.width).toBeCloseTo(2 / 3);
    expect(nextPreset(twoThirds, "a", presets)[0]?.width).toBeCloseTo(1 / 3);
  });

  test("a preset ends maximizing, and maximizing toggles back", () => {
    const full = toggleFull(of(["a"]), "a");
    expect(full[0]?.full).toBe(true);
    expect(toggleFull(full, "a")[0]).toEqual({ windows: ["a"], width: HALF, full: false });
    expect(nextPreset(full, "a", presets)[0]?.full).toBe(false);
  });
});

describe("scrolling", () => {
  const view = 1000;

  test("stays put while the span is in view", () => {
    expect(scrollTo(0, { start: 410, end: 810 }, view)).toBe(0);
  });

  test("scrolls right just far enough", () => {
    expect(scrollTo(0, { start: 820, end: 1220 }, view)).toBe(220);
  });

  test("scrolls left to the span's start", () => {
    expect(scrollTo(800, { start: 410, end: 810 }, view)).toBe(410);
  });

  test("centers a span", () => {
    expect(center({ start: 820, end: 1220 }, view)).toBe(520);
  });

  const strip = [
    { start: 0, end: 400 },
    { start: 410, end: 810 },
    { start: 820, end: 1220 },
  ];

  test("fills the view up to the strip's end", () => {
    // The last column closed: the view was at 520, past the strip's new end.
    expect(filled(520, strip.slice(0, 2), view)).toBe(0);
    expect(filled(520, strip, view)).toBe(220);
  });

  test("leaves a scroll that shows no empty view", () => {
    expect(filled(100, strip, view)).toBe(100);
  });

  test("starts a strip narrower than the view at its left", () => {
    expect(filled(300, strip.slice(0, 1), view)).toBe(0);
    expect(filled(-50, strip, view)).toBe(0);
    expect(filled(300, [], view)).toBe(0);
  });
});
