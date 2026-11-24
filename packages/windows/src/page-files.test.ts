import { FileChooserMode } from "@domicile-desktop/sdk/portal";
import { expect, test } from "bun:test";

import { chooserOf } from "./page-files";

const asked = (mode: string, more: Partial<Parameters<typeof chooserOf>[0]> = {}) =>
  chooserOf({ accept: [], currentFolder: "", home: "/home/me", mode, suggestedName: "", ...more });

test("an upload opens files, one or several, from the home", () => {
  expect(asked("open")).toMatchObject({ mode: FileChooserMode.Open, multiple: false, directory: false });
  expect(asked("open-multiple")).toMatchObject({ mode: FileChooserMode.Open, multiple: true });
  expect(asked("open").currentFolder).toBeUndefined();
  expect(asked("open-folder")).toMatchObject({ mode: FileChooserMode.Open, directory: true });
});

test("a download saves under its name, in its folder", () => {
  expect(asked("save", { suggestedName: "a.pdf", currentFolder: "/home/me/Downloads" })).toMatchObject({
    mode: FileChooserMode.Save,
    currentName: "a.pdf",
    currentFolder: "/home/me/Downloads",
  });
});

test("what the page accepts is a filter that can be lifted", () => {
  expect(asked("open").filters).toEqual([]);
  expect(asked("open", { accept: ["png", "jpg"] }).filters).toEqual([
    { name: ".png .jpg", extensions: ["png", "jpg"] },
    { name: "All files", extensions: [] },
  ]);
});
