import { describe, expect, test } from "bun:test";

import { type Binding, type Group, matching, onKeys, partsOf, shownChord } from "./binding";

const binding = (chord: string, label: string, group: Group = "Windows"): Binding => ({
  chord,
  group,
  label,
  run: () => undefined,
});

const bindings = [
  binding("Meta+q", "Close the window"),
  binding("Meta+Shift+H", "Move the column left", "Move"),
  binding("Meta+h", "Focus left", "Focus"),
  binding("Meta+Return", "Terminal", "Apps"),
  binding("Print", "Screenshot", "Desktop"),
];

describe("partsOf", () => {
  test("puts a shifted letter on its lower-case key", () => {
    expect(partsOf("Meta+Shift+H")).toEqual({ key: "h", modifiers: new Set(["Meta", "Shift"]) });
  });

  test("keeps a keysym name as it is", () => {
    expect(partsOf("Meta+bracketleft")).toEqual({ key: "bracketleft", modifiers: new Set(["Meta"]) });
  });
});

describe("onKeys", () => {
  const labels = (keys: ReadonlyMap<string, readonly Binding[]>) =>
    [...keys].map(([key, on]) => [key, on.map(({ label }) => label)]);

  test("finds the bindings the held modifiers fire, exactly", () => {
    expect(labels(onKeys(bindings, new Set(["Meta"])))).toEqual([
      ["q", ["Close the window"]],
      ["h", ["Focus left"]],
      ["Return", ["Terminal"]],
    ]);
  });

  test("tells Meta+Shift apart from Meta", () => {
    expect([...onKeys(bindings, new Set(["Shift", "Meta"])).keys()]).toEqual(["h"]);
  });

  test("lists every binding on a key while nothing is held", () => {
    expect(labels(onKeys(bindings, new Set())).find(([key]) => key === "h")).toEqual([
      "h",
      ["Move the column left", "Focus left"],
    ]);
  });
});

describe("matching", () => {
  test("finds by every word, in group order", () => {
    expect(matching(bindings, "left").map(({ label }) => label)).toEqual(["Focus left", "Move the column left"]);
  });

  test("finds by the chord as it is shown", () => {
    expect(matching([binding("Meta+bracketleft", "Take in")], "meta + [").map(({ label }) => label)).toEqual([
      "Take in",
    ]);
  });

  test("lists everything for no query", () => {
    expect(matching(bindings, " ").length).toBe(bindings.length);
  });
});

describe("shownChord", () => {
  test("writes symbol keysyms as their characters", () => {
    expect(shownChord("Meta+Shift+question")).toBe("Meta + Shift + ?");
  });
});
