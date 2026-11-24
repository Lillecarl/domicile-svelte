import { expect, test } from "bun:test";

import { type AppMenuEntry, acceleratorOf, MenuEntryKind, ToggleKind } from "@domicile-desktop/sdk/app-menu";

import { commandFor, commandsOf } from "./commands";
import { entriesOf } from "./entries";

const command = (name: string, keys: string | undefined) => ({
  name,
  description: name,
  global: false,
  keys: keys === undefined ? undefined : acceleratorOf(keys),
});
const extensions = {
  commands: [
    { id: "a", name: "A", profile: "default", commands: [command("lock", undefined)] },
    { id: "b", name: "B", profile: "default", commands: [command("fill", "Ctrl+Shift+L")] },
  ],
};
const press = { altKey: false, code: "KeyL", ctrlKey: true, key: "L", metaKey: false, shiftKey: true };

test("a press finds the command its keys are bound to", () => {
  expect(commandFor(extensions, press)).toMatchObject({ id: "b", command: { name: "fill" } });
  expect(commandFor(extensions, { ...press, shiftKey: false })).toBeUndefined();
  expect(commandFor({ commands: undefined }, press)).toBeUndefined();
});

test("an extension's own commands", () => {
  expect(commandsOf(extensions, "a").map(({ name }) => name)).toEqual(["lock"]);
  expect(commandsOf(extensions, "c")).toEqual([]);
});

test("a menu keeps its nesting, toggles and state, and runs by id", () => {
  const item = { icon: undefined, mnemonic: undefined, accelerator: undefined, toggle: undefined, submenu: undefined };
  const menu: AppMenuEntry[] = [
    {
      ...item,
      kind: MenuEntryKind.Item,
      id: 1,
      label: "Vault",
      enabled: true,
      submenu: [
        {
          ...item,
          kind: MenuEntryKind.Item,
          id: 2,
          label: "Remember",
          enabled: false,
          toggle: { kind: ToggleKind.Checkmark, checked: true },
        },
      ],
    },
    { kind: MenuEntryKind.Separator, id: 3 },
  ];
  const ran: number[] = [];
  const [vault, separator] = entriesOf(menu, (id) => ran.push(id));
  expect(separator).toEqual({ kind: "separator", key: "3" });
  expect(vault).toMatchObject({
    label: "Vault",
    submenu: [{ key: "2", enabled: false, toggle: { kind: "check", on: true } }],
  });
  if (vault?.kind === "item") {
    vault.run?.();
  }
  expect(ran).toEqual([1]);
});
