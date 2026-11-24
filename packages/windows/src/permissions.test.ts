import { expect, test } from "bun:test";
import type { Item } from "@domicile-svelte/menu";
import { WEBVIEW_PERMISSIONS } from "@domicile-desktop/sdk/webview-element";

import { asksTo, permissionMenu } from "./permissions";

test("a request says all it asks", () => {
  expect(asksTo(["camera", "microphone"])).toBe("use your camera and use your microphone");
});

test("a request with a permission this shell cannot name is not asked", () => {
  expect(asksTo(["camera", "teleport"])).toBeUndefined();
  expect(asksTo(["toString"])).toBeUndefined();
  expect(asksTo([])).toBeUndefined();
});

test("every permission of the SDK has words", () => {
  for (const permission of WEBVIEW_PERMISSIONS) {
    expect(asksTo([permission])).toBeString();
  }
});

test("the menu shows each setting and stores the one picked", () => {
  const set: string[] = [];
  const [root] = permissionMenu({ camera: "block", unknown: "ask" }, (...choice) => set.push(choice.join(" ")));
  const [camera, ...rest] = ((root as Item).submenu ?? []) as Item[];
  expect(rest).toEqual([]);
  expect([camera?.label, camera?.hint]).toEqual(["Camera", "Block"]);
  const choices = (camera?.submenu ?? []) as Item[];
  expect(choices.map(({ label, toggle }) => [label, toggle?.on])).toEqual([
    ["Ask", false],
    ["Allow", false],
    ["Block", true],
  ]);
  choices[1]?.run?.();
  expect(set).toEqual(["camera allow"]);
});

test("a page with no site has no menu", () => {
  expect(permissionMenu({}, () => undefined)).toEqual([]);
});
