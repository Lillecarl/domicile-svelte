import { describe, expect, test } from "bun:test";

import { neighbor, scrollTo, sync } from "./columns";

describe("sync", () => {
  test("opens a new window as a column right of the focused one", () => {
    expect(sync([["a"], ["b"]], ["a", "b", "c"], "a")).toEqual([["a"], ["c"], ["b"]]);
  });

  test("appends with nothing focused", () => {
    expect(sync([["a"]], ["a", "b"], undefined)).toEqual([["a"], ["b"]]);
  });

  test("drops closed windows and the columns they empty", () => {
    expect(sync([["a", "b"], ["c"]], ["a"], "a")).toEqual([["a"]]);
  });
});

describe("neighbor", () => {
  const columns = [["a"], ["b", "c"], ["d"]];

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
});

describe("scrollTo", () => {
  const sizes = { column: 400, gap: 10, view: 1000 };

  test("stays put while the column is in view", () => {
    expect(scrollTo(0, 1, sizes)).toBe(0);
  });

  test("scrolls right just far enough", () => {
    expect(scrollTo(0, 2, sizes)).toBe(820 + 400 - 1000);
  });

  test("scrolls left to the column's start", () => {
    expect(scrollTo(800, 1, sizes)).toBe(410);
  });
});
