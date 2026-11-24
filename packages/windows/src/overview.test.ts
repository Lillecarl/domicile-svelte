import { describe, expect, test } from "bun:test";

import { type Columns, place } from "./columns";
import { boundsOf, clampPan, dropAt, dropped, markOf, panTo, parkedRow, ROW_GAP, zoomFor } from "./overview";

const column = (...windows: string[]) => ({ windows, width: 0.5, full: false });
const columns: Columns = [column("a"), column("b", "c"), column("d")];
const view = { width: 1008, height: 800 };
const boxes = place(columns, { view: view.width, gap: 8, height: view.height });
const ids = (all: Columns) => all.map(({ windows }) => windows.join("+"));

describe("the camera", () => {
  test("a short strip is drawn at half size, in the middle", () => {
    const bounds = { x: 0, y: 0, width: 600, height: 800 };
    expect(zoomFor(bounds, view)).toBe(0.5);
    expect(clampPan(9999, bounds, view, 0.5)).toBe(300);
  });

  test("a longer one shrinks to fit, and the longest pans", () => {
    expect(zoomFor({ x: 0, y: 0, width: 2268, height: 800 }, view)).toBeCloseTo(0.4);
    const long = { x: 0, y: 0, width: 10_000, height: 800 };
    expect(zoomFor(long, view)).toBe(0.25);
    expect(clampPan(0, long, view, 0.25)).toBeCloseTo(1814.4);
    expect(clampPan(99_999, long, view, 0.25)).toBeCloseTo(10_000 - 1814.4);
  });

  test("two rows fit the height", () => {
    const bounds = { x: 0, y: 0, width: 600, height: 1664 };
    expect(zoomFor(bounds, view) * 1664).toBeLessThanOrEqual(720.0001);
  });

  test("panning shows a window with the least movement", () => {
    expect(panTo(2000, { x: 0, y: 0, width: 500, height: 1 }, view, 0.25)).toBeCloseTo(1814.4);
    expect(panTo(2000, { x: 1800, y: 0, width: 500, height: 1 }, view, 0.25)).toBe(2000);
  });
});

test("parked windows are in a row under the strip, centered on it", () => {
  const row = parkedRow(
    new Map([
      ["p", { width: 100, height: 50 }],
      ["q", { width: 200, height: 60 }],
    ]),
    { strip: 1000, height: 800, gap: 8 },
  );
  expect(row.get("p")).toEqual({ x: 346, y: 800 + ROW_GAP, width: 100, height: 50 });
  expect(row.get("q")?.x).toBe(454);
  expect(boundsOf(row.values())).toMatchObject({ x: 0, y: 0, width: 654 });
});

describe("a dragged window", () => {
  test("goes beside a column near its edge, and past the ends", () => {
    expect(dropAt(columns, boxes, "a", { x: 520, y: 10 })).toEqual({ anchor: "b", side: "left" });
    expect(dropAt(columns, boxes, "a", { x: 1000, y: 10 })).toEqual({ anchor: "b", side: "right" });
    expect(dropAt(columns, boxes, "d", { x: -500, y: 10 })).toEqual({ anchor: "a", side: "left" });
    expect(dropAt(columns, boxes, "a", { x: 9000, y: 10 })).toEqual({ anchor: "d", side: "right" });
  });

  test("goes into a column in its middle, above or below a window", () => {
    expect(dropAt(columns, boxes, "a", { x: 760, y: 10 })).toEqual({ anchor: "b", side: "above" });
    expect(dropAt(columns, boxes, "a", { x: 760, y: 390 })).toEqual({ anchor: "b", side: "below" });
    expect(dropAt(columns, boxes, "a", { x: 760, y: 790 })).toEqual({ anchor: "c", side: "below" });
  });

  test("stays where it is when it is dropped on itself", () => {
    expect(dropAt(columns, boxes, "a", { x: 10, y: 10 })).toBeUndefined();
    expect(dropAt(columns, boxes, "a", { x: 250, y: 10 })).toBeUndefined();
    expect(dropped(columns, "a", { anchor: "a", side: "left" }, 0.5)).toBe(columns);
  });

  test("leaves its stack by the stack's own edge", () => {
    const drop = dropAt(columns, boxes, "b", { x: 520, y: 10 });
    expect(drop).toEqual({ anchor: "c", side: "left" });
    expect(ids(dropped(columns, "b", drop ?? { anchor: "", side: "left" }, 0.5))).toEqual(["a", "b", "c", "d"]);
  });

  test("moves, stacks, and keeps its column's width when it was alone", () => {
    const wide = [{ ...column("a"), width: 0.7 }, ...columns.slice(1)];
    const moved = dropped(wide, "a", { anchor: "d", side: "right" }, 0.5);
    expect(ids(moved)).toEqual(["b+c", "d", "a"]);
    expect(moved[2]?.width).toBe(0.7);
    expect(ids(dropped(columns, "a", { anchor: "c", side: "above" }, 0.5))).toEqual(["b+a+c", "d"]);
    expect(ids(dropped(columns, "c", { anchor: "b", side: "above" }, 0.5))).toEqual(["a", "c+b", "d"]);
  });

  test("a parked one, on no column yet, is placed the same", () => {
    expect(ids(dropped(columns, "p", { anchor: "a", side: "below" }, 0.5))).toEqual(["a+p", "b+c", "d"]);
  });

  test("is marked as tall as the column beside it", () => {
    expect(markOf(columns, boxes, { anchor: "c", side: "left" }, 8)).toEqual({ x: 500, y: 0, width: 8, height: 800 });
    expect(markOf(columns, boxes, { anchor: "b", side: "below" }, 8)).toMatchObject({ y: 396, height: 8 });
  });
});
