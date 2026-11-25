import { expect, test } from "bun:test";
import { appMenu } from "@domicile-desktop/sdk/app-menu";
import { messageBox } from "@domicile-desktop/sdk/message-box";

import { appEntries, boxAsk } from "./app-menu";

const entry = (id: number, more: object = {}) => ({
  id,
  type: "normal",
  label: `entry ${id}`,
  enabled: true,
  visible: true,
  checked: false,
  ...more,
});

test("an app's menu", () => {
  const chosen: number[] = [];
  const menu = appMenu(
    JSON.stringify([
      entry(1, { type: "submenu", label: "&File", submenu: [entry(2, { accelerator: "CmdOrCtrl+N" })] }),
      entry(3, { type: "separator" }),
      entry(4, { type: "checkbox", checked: true }),
      entry(5, { type: "radio", enabled: false }),
    ]),
  );
  const [file, separator, check, radio] = appEntries(menu, (id) => chosen.push(id));
  expect(separator).toEqual({ kind: "separator", key: "3" });
  expect(check).toMatchObject({ toggle: { kind: "check", on: true } });
  expect(radio).toMatchObject({ toggle: { kind: "radio", on: false }, enabled: false });
  expect(file).toMatchObject({ label: "File" });
  const inner = file?.kind === "item" ? file.submenu?.[0] : undefined;
  expect(inner).toMatchObject({ hint: "Ctrl+N" });
  if (inner?.kind === "item") {
    inner.run?.();
  }
  expect(chosen).toEqual([2]);
});

const box = (more: object = {}) =>
  messageBox(
    JSON.stringify({
      type: "question",
      title: "App",
      message: "Save?",
      detail: "",
      buttons: ["Discard", "Cancel", "Save"],
      defaultId: 2,
      cancelId: 1,
      checkboxLabel: "Do not ask again",
      checkboxChecked: true,
      ...more,
    }),
  );
const answered = { texts: [], choice: 0, ticked: false };

test("a message box's buttons answer by their places", () => {
  const answers: [number, boolean][] = [];
  const ask = boxAsk(box(), (button, ticked) => answers.push([button, ticked]));
  expect(ask).toMatchObject({ title: "Save?", yes: "Save", no: "Cancel", tick: "Do not ask again", ticked: true });
  ask.accept({ ...answered, ticked: true });
  ask.dismiss(answered);
  expect(ask.extra?.map(({ label }) => label)).toEqual(["Discard"]);
  ask.extra?.[0]?.run(answered);
  expect(answers).toEqual([
    [2, true],
    [1, false],
    [0, false],
  ]);
});

test("a message box of one button, and one with no default", () => {
  const one = boxAsk(box({ buttons: ["OK"], defaultId: 0, cancelId: 0, checkboxLabel: "" }), () => undefined);
  expect(one).toMatchObject({ yes: "OK", extra: [] });
  expect(one).not.toHaveProperty("no");
  expect(one).not.toHaveProperty("tick");
  const none = boxAsk(box({ defaultId: -1 }), () => undefined);
  expect(none).not.toHaveProperty("yes");
  expect(none.extra?.map(({ label }) => label)).toEqual(["Discard", "Save"]);
});
