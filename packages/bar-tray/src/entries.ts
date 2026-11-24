import { type MenuEntry, MenuEntryKind, ToggleKind } from "@domicile-desktop/sdk/dbusmenu";
import type { Entry } from "@domicile-svelte/menu";

type Calls = {
  click: (id: number) => void;
  show: (id: number) => void;
  /** A theme icon's URL. */
  icon: (name: string | undefined) => string | undefined;
};

/** An application's menu as the shell draws one. */
export const entriesOf = (menu: readonly MenuEntry[], calls: Calls): Entry[] =>
  menu.map((entry): Entry => {
    const key = String(entry.id);
    return entry.kind === MenuEntryKind.Separator
      ? { kind: "separator", key }
      : {
          kind: "item",
          key,
          label: entry.label,
          enabled: entry.enabled,
          image: entry.image ?? calls.icon(entry.icon),
          toggle: entry.toggle && {
            kind: entry.toggle.kind === ToggleKind.Radio ? "radio" : "check",
            on: entry.toggle.checked,
          },
          submenu: entry.submenu && entriesOf(entry.submenu, calls),
          run: () => calls.click(entry.id),
          onshow: () => calls.show(entry.id),
        };
  });
