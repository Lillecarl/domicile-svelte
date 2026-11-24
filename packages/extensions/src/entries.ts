import { type AppMenuEntry, appMenu, MenuEntryKind, ToggleKind } from "@domicile-desktop/sdk/app-menu";
// For `DomicileContextMenuEvent`, which it declares globally.
import type {} from "@domicile-desktop/sdk/webview-element";
import type { Entry } from "@domicile-svelte/menu";

/** An extension's menu as the shell draws one. */
export const entriesOf = (menu: readonly AppMenuEntry[], run: (id: number) => void): Entry[] =>
  menu.map((entry): Entry => {
    const key = String(entry.id);
    return entry.kind === MenuEntryKind.Separator
      ? { kind: "separator", key }
      : {
          kind: "item",
          key,
          label: entry.label,
          enabled: entry.enabled,
          image: entry.icon,
          toggle: entry.toggle && {
            kind: entry.toggle.kind === ToggleKind.Radio ? "radio" : "check",
            on: entry.toggle.checked,
          },
          submenu: entry.submenu && entriesOf(entry.submenu, run),
          run: () => run(entry.id),
        };
  });

/** The items extensions add to a page's menu. None on an engine that has no such items. */
export const extensionItemsOf = (event: DomicileContextMenuEvent): Entry[] =>
  "extensionItems" in event
    ? entriesOf(appMenu(event.extensionItems), (id) => event.runExtensionItem(id))
    : [];
