import { describe, expect, test } from "bun:test";

import { columnOfWidth } from "./columns";
import {
  droppedIn,
  emptyWorkspace,
  movedTo,
  placeAll,
  rowAt,
  rowsOf,
  synced,
  tidied,
  type Workspaces,
  workspaceOf,
} from "./workspaces";

const workspace = (id: number, ...columns: string[]) => ({
  ...emptyWorkspace(id),
  columns: columns.map((windows) => columnOfWidth(windows.split("+"), 0.5)),
});
const said = (workspaces: Workspaces) =>
  workspaces.map(({ id, columns, floating }) =>
    [id, ...columns.map(({ windows }) => windows.join("+")), ...floating.map((key) => `~${key}`)].join(" "),
  );
const three: Workspaces = [workspace(1, "a", "b+c"), workspace(2, "d"), emptyWorkspace(3)];

describe("tidied", () => {
  test("drops the empty ones but the current and the last", () => {
    const all = [emptyWorkspace(1), workspace(2, "a"), emptyWorkspace(3), emptyWorkspace(4)];
    expect(said(tidied(all, 2))).toEqual(["2 a", "4"]);
    expect(said(tidied(all, 3))).toEqual(["2 a", "3", "4"]);
    expect(said(tidied(all, 4))).toEqual(["2 a", "4"]);
  });

  test("adds an empty one when the last has a window", () => {
    expect(said(tidied([workspace(1, "a")], 1))).toEqual(["1 a", "2"]);
    expect(said(tidied([workspace(5, "a"), workspace(3, "b")], 3))).toEqual(["5 a", "3 b", "6"]);
    expect(said(tidied([emptyWorkspace(1)], 1))).toEqual(["1"]);
  });

  test("keeps the ids, so the same ones stay the same", () => {
    expect(tidied(three, 1)).toEqual(three);
  });
});

describe("synced", () => {
  test("drops what closed, and opens beside the focus", () => {
    const open = { tiled: ["a", "b", "d", "new"], floating: ["f"] };
    expect(said(synced(three, open, 1, "a", 0.5))).toEqual(["1 a new b ~f", "2 d", "3"]);
    expect(said(synced(three, open, 3, undefined, 0.5))).toEqual(["1 a b", "2 d", "3 new ~f"]);
  });

  test("leaves a floating window where it is", () => {
    const at2 = [workspace(1), { ...workspace(2), floating: ["f"] }];
    expect(said(synced(at2, { tiled: [], floating: ["f"] }, 1, undefined, 0.5))).toEqual(["1", "2 ~f"]);
  });
});

describe("movedTo", () => {
  test("takes a window, or its column, after the focus there", () => {
    expect(said(movedTo(three, "b", 2, "window", undefined))).toEqual(["1 a c", "2 d b", "3"]);
    expect(said(movedTo(three, "b", 2, "column", "d"))).toEqual(["1 a", "2 d b+c", "3"]);
    expect(said(movedTo(three, "d", 1, "column", "a"))).toEqual(["1 a d b+c", "2", "3"]);
  });

  test("changes nothing for the same workspace, or none", () => {
    expect(movedTo(three, "a", 1, "column", undefined)).toBe(three);
    expect(movedTo(three, "a", 9, "column", undefined)).toBe(three);
    expect(movedTo(three, "z", 1, "column", undefined)).toBe(three);
  });

  test("takes a floating window", () => {
    const floating = [{ ...workspace(1, "a"), floating: ["f"] }, emptyWorkspace(2)];
    expect(said(movedTo(floating, "f", 2, "column", undefined))).toEqual(["1 a", "2 ~f"]);
  });
});

describe("droppedIn", () => {
  test("goes beside or into a column of another workspace", () => {
    expect(said(droppedIn(three, "a", { anchor: "d", side: "left" }, 0.5))).toEqual(["1 b+c", "2 a d", "3"]);
    expect(said(droppedIn(three, "c", { anchor: "d", side: "below" }, 0.5))).toEqual(["1 a b", "2 d+c", "3"]);
    expect(said(droppedIn(three, "c", { anchor: "a", side: "left" }, 0.5))).toEqual(["1 c a b", "2 d", "3"]);
    expect(said(droppedIn(three, "c", 3, 0.5))).toEqual(["1 a b", "2 d", "3 c"]);
  });
});

test("rows are down from the current one", () => {
  const rows = rowsOf(three, 2, { height: 800, gap: 8, empty: 100 });
  expect([...rows]).toEqual([
    [1, { y: -808, height: 800 }],
    [2, { y: 0, height: 800 }],
    [3, { y: 808, height: 100 }],
  ]);
  expect([-9999, -10, 0, 850].map((y) => rowAt(rows, y))).toEqual([1, 1, 2, 3]);
  const boxes = placeAll(three, { view: 1008, gap: 8, height: 800 }, rows, (id) => (id === 1 ? 50 : 0));
  expect(boxes.get("c")).toMatchObject({ x: 558, y: -404 });
  expect(boxes.get("d")).toMatchObject({ x: 0, y: 0 });
});

test("finds a window's workspace", () => {
  expect(workspaceOf(three, "c")).toBe(1);
  expect(workspaceOf(three, "z")).toBeUndefined();
  expect(workspaceOf(three, undefined)).toBeUndefined();
});
