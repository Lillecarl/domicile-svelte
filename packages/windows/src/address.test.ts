import { expect, test } from "bun:test";

import { addressOf } from "./address";

test("a URL with a scheme loads as typed", () => {
  expect(addressOf(" about:blank ")).toEqual({ kind: "url", url: "about:blank" });
  expect(addressOf("http://localhost:8080")).toEqual({ kind: "url", url: "http://localhost:8080" });
});

test("a dotted word loads over https", () => {
  expect(addressOf("en.wikipedia.org/wiki/Vim")).toEqual({ kind: "url", url: "https://en.wikipedia.org/wiki/Vim" });
});

test("anything else searches", () => {
  expect(addressOf("vim modes")).toEqual({
    kind: "search",
    url: "https://duckduckgo.com/?q=vim%20modes",
    words: "vim modes",
  });
});

test("blank text names nothing", () => {
  expect(addressOf("   ")).toBeUndefined();
});
