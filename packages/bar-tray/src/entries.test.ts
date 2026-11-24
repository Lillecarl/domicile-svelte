import { expect, test } from "bun:test";
import { MenuEntry, ToggleKind } from "@domicile-desktop/sdk/dbusmenu";

import { entriesOf } from "./entries";

const item = {
  id: 1,
  label: "One",
  mnemonic: undefined,
  enabled: true,
  icon: "go-up",
  image: undefined,
  toggle: undefined,
  submenu: undefined,
};

test("an application's menu", () => {
  const clicked: number[] = [];
  const [one, separator, sub] = entriesOf(
    [
      MenuEntry.Item(item),
      MenuEntry.Separator(2),
      MenuEntry.Item({
        ...item,
        id: 3,
        image: "data:,",
        submenu: [
          MenuEntry.Item({ ...item, id: 4, enabled: false, toggle: { kind: ToggleKind.Radio, checked: true } }),
        ],
      }),
    ],
    { click: (id) => clicked.push(id), show: () => undefined, icon: (name) => name && `icon:${name}` },
  );
  expect(separator).toEqual({ kind: "separator", key: "2" });
  expect(one).toMatchObject({ key: "1", label: "One", image: "icon:go-up", submenu: undefined });
  expect(sub).toMatchObject({
    image: "data:,",
    submenu: [{ key: "4", enabled: false, toggle: { kind: "radio", on: true } }],
  });
  if (one?.kind === "item") {
    one.run?.();
  }
  expect(clicked).toEqual([1]);
});
