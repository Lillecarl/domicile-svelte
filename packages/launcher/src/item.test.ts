import { expect, test } from "bun:test";

import { matching } from "./item";

const windows = [
  { title: "pymux ~", app: "kitty" },
  { title: "Vim (text editor) - Wikipedia", app: "browser" },
  { title: "kitty config", app: "editor" },
];
const texts = (window: (typeof windows)[number]) => [window.title, window.app];

test("a blank query keeps every item in order", () => {
  expect(matching(windows, "  ", texts)).toEqual(windows);
});

test("every word must appear in some text, in any case", () => {
  expect(matching(windows, "WIKI vim", texts)).toEqual([windows[1]]);
  expect(matching(windows, "vim emacs", texts)).toEqual([]);
});

test("a first text that starts with the query ranks first", () => {
  expect(matching(windows, "kitty", texts)).toEqual([windows[2], windows[0]]);
});
