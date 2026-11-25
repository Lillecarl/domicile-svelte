import { type AppMenuEntry, MenuEntryKind, ToggleKind } from "@domicile-desktop/sdk/app-menu";
import type { MessageBox } from "@domicile-desktop/sdk/message-box";
import type { Entry } from "@domicile-svelte/menu";

import type { Ask } from "./ask";

/** An Electron app's menu, as the shell draws menus. */
export const appEntries = (entries: readonly AppMenuEntry[], choose: (id: number) => void): Entry[] =>
  entries.map((entry): Entry => {
    if (entry.kind === MenuEntryKind.Separator) {
      return { kind: "separator", key: `${entry.id}` };
    }
    const { id, label, enabled, icon, accelerator, toggle, submenu } = entry;
    return {
      kind: "item",
      key: `${id}`,
      label,
      enabled,
      image: icon,
      hint: accelerator?.label,
      toggle:
        toggle === undefined
          ? undefined
          : { kind: toggle.kind === ToggleKind.Radio ? "radio" : "check", on: toggle.checked },
      submenu: submenu === undefined ? undefined : appEntries(submenu, choose),
      run: () => choose(id),
    };
  });

/** An Electron app's message box. Its default button is the one that says yes. */
export const boxAsk = (box: MessageBox, answer: (button: number, ticked: boolean) => void): Ask => {
  const { buttons, defaultButton, cancelButton } = box;
  const press = (button: number) => ({
    label: buttons[button] ?? "",
    run: ({ ticked }: { ticked: boolean }) => answer(button, ticked),
  });
  const yes = defaultButton === undefined ? undefined : press(defaultButton);
  const no = press(cancelButton);
  return {
    title: box.message,
    ...(box.detail === "" ? {} : { message: box.detail }),
    ...(box.checkbox === undefined ? {} : { tick: box.checkbox, ticked: box.checkboxChecked }),
    ...(yes === undefined ? {} : { yes: yes.label }),
    ...(defaultButton === cancelButton ? {} : { no: no.label }),
    extra: buttons.flatMap((_, button) => (button === defaultButton || button === cancelButton ? [] : [press(button)])),
    accept: (answered) => (yes ?? no).run(answered),
    dismiss: no.run,
  };
};
