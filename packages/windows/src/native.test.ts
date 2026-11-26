import { expect, test } from "bun:test";

import { argvOf, claimed, isSavedNative, relaunched, type SavedNative } from "./native";

const window = (key: string, more: Partial<SavedNative> = {}): SavedNative => ({
  key,
  desktopId: "kitty",
  title: key,
  pid: 10,
  pidfdInode: 99,
  argv: ["/home/me/.nix-profile/bin/kitty"],
  ...more,
});

test("a command line is split on its NULs", () => {
  expect(argvOf(new TextEncoder().encode("kitty\0-e\0pymux attach\0"))).toEqual(["kitty", "-e", "pymux attach"]);
});

test("a window whose process still runs keeps its key, and nothing starts", () => {
  const again = relaunched([window("app-1")], [{ key: "app-1", pid: 10, pidfdInode: 99 }]);
  expect(again.keys.get("app-1")).toBe("app-1");
  expect(again.starting).toEqual([]);
  expect(again.commands).toEqual([]);
});

test("a key the compositor gave a new process is a new window", () => {
  const again = relaunched([window("app-1")], [{ key: "app-1", pid: 10, pidfdInode: 100 }]);
  expect(again.keys.get("app-1")).toBe("starting:0");
  expect(again.commands).toEqual([["/home/me/.nix-profile/bin/kitty"]]);
});

test("a process with two windows starts once and is waited for twice", () => {
  const again = relaunched([window("app-1"), window("app-2"), window("app-3", { pid: 11 })], []);
  expect(again.starting.map(({ key }) => key)).toEqual(["starting:0", "starting:1", "starting:2"]);
  expect(again.commands).toHaveLength(2);
});

test("a window without a desktop id starts but is not waited for", () => {
  const again = relaunched([window("app-1", { desktopId: "" })], []);
  expect(again.starting).toEqual([]);
  expect(again.keys.has("app-1")).toBe(false);
  expect(again.commands).toHaveLength(1);
});

test("a window whose command line was never read is let go", () => {
  const again = relaunched([window("app-1", { argv: [] })], []);
  expect(again.keys.has("app-1")).toBe(false);
  expect(again.commands).toEqual([]);
});

test("a new window takes the first place its app waits in", () => {
  const starting = [
    { key: "starting:0", desktopId: "kitty", title: "" },
    { key: "starting:1", desktopId: "kitty", title: "" },
  ];
  expect(claimed(starting, "kitty")?.key).toBe("starting:0");
  expect(claimed(starting, "foot")).toBeUndefined();
  expect(claimed([{ key: "starting:0", desktopId: "", title: "" }], "")).toBeUndefined();
});

test("a saved native window is checked field by field", () => {
  expect(isSavedNative(window("app-1"))).toBe(true);
  expect(isSavedNative({ ...window("app-1"), argv: [1] })).toBe(false);
  expect(isSavedNative({ ...window("app-1"), pid: "10" })).toBe(false);
  expect(isSavedNative(JSON.parse(JSON.stringify(window("app-1", { pid: undefined }))))).toBe(true);
});
