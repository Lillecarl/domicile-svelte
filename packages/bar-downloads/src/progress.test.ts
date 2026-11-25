import { expect, test } from "bun:test";
import { DownloadState } from "@domicile-desktop/sdk/desktop/downloads";

import { detail, fileName, folder, fraction, progress, site } from "./progress";

const sized = (receivedBytes: number, totalBytes: number) => ({ receivedBytes, totalBytes });

test("says what came in, in the total's unit", () => {
  expect(progress(sized(4_200_000, 18_000_000))).toBe("4.2 of 18 MB");
  expect(progress(sized(0, 999))).toBe("0 of 999 B");
  expect(progress(sized(1500, 0))).toBe("1.5 kB so far");
});

test("adds up the downloads, unless a size is unknown", () => {
  expect(fraction([sized(50, 100), sized(0, 100)])).toBe(0.25);
  expect(fraction([sized(50, 100), sized(7, 0)])).toBeUndefined();
  expect(fraction([])).toBeUndefined();
});

test("splits a path", () => {
  expect(fileName("/home/me/a b.txt")).toBe("a b.txt");
  expect(folder("/home/me/a b.txt")).toBe("/home/me");
  expect(folder("/a")).toBe("/");
});

test("names the site, where the page has one", () => {
  expect(site("https://www.example.com/x")).toBe("www.example.com");
  expect(site("about:blank")).toBeUndefined();
  expect(site("")).toBeUndefined();
});

test("describes each state", () => {
  const download = { page: "https://a.b/", ...sized(10, 20) };
  expect(detail({ ...download, state: DownloadState.InProgress })).toBe("10 of 20 B · a.b");
  expect(detail({ ...download, state: DownloadState.Complete })).toBe("10 B · a.b");
  expect(detail({ ...download, page: "", state: DownloadState.Failed })).toBe("Failed");
});
