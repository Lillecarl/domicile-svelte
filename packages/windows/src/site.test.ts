import { expect, test } from "bun:test";

import { shieldMenu, shieldOf, siteOf } from "./site";

test("a web address shows its host apart from the rest", () => {
  expect(siteOf("https://example.com/")).toEqual({ secure: true, host: "example.com", rest: "" });
  expect(siteOf("http://example.com:8080/a?b=c#d")).toEqual({
    secure: false,
    host: "example.com:8080",
    rest: "/a?b=c",
  });
});

test("an address that is not on the web has no site", () => {
  expect(siteOf("about:blank")).toBeUndefined();
  expect(siteOf("")).toBeUndefined();
  expect(siteOf("file:///etc/hosts")).toBeUndefined();
});

const page = {
  privacySite: "example.com",
  blockAdsAndTrackers: "strict",
  blockAdsAndTrackersSetFor: "site",
  blockedCount: 3,
};

test("a page off the web, or with a mode the shell does not know, has no shield", () => {
  expect(shieldOf({ ...page, privacySite: "", blockAdsAndTrackers: "" })).toBeUndefined();
  expect(shieldOf({ ...page, blockAdsAndTrackers: "paranoid" })).toBeUndefined();
});

test("the shield menu ticks the mode kept for the site", () => {
  const shield = shieldOf(page);
  if (shield === undefined) {
    throw new Error("no shield");
  }
  const set: (string | null)[] = [];
  const menu = shieldMenu(shield, (mode) => set.push(mode));
  const ticked = menu.flatMap((entry) => (entry.kind === "item" && entry.toggle?.on === true ? [entry.key] : []));
  expect(ticked).toEqual(["strict"]);
  for (const entry of menu) {
    if (entry.kind === "item") {
      entry.run?.();
    }
  }
  expect(set).toEqual(["standard", "strict", "off", null]);
});

test("a site with nothing kept follows the profile", () => {
  const shield = shieldOf({ ...page, blockAdsAndTrackersSetFor: "profile" });
  const ticked = shield === undefined ? [] : shieldMenu(shield, () => undefined);
  expect(ticked.flatMap((entry) => (entry.kind === "item" && entry.toggle?.on === true ? [entry.key] : []))).toEqual([
    "profile",
  ]);
});
