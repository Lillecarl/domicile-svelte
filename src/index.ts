import type { Shell as ShellModule } from "@domicile-desktop/sdk/shell";
import { mount } from "svelte";

import Desktop from "./Desktop.svelte";
import { desktopKey } from "./desktop";

/** Mounts into a container of its own: Domicile reports load errors by appending to `root`. */
export const Shell: ShellModule = (root, domicile) => {
  const target = document.createElement("div");
  root.append(target);
  mount(Desktop, { target, context: new Map([[desktopKey, domicile]]) });
  domicile.processes.launch(["kitty"]);
};
