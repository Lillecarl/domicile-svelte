import { mountShell } from "@domicile-svelte/svelte";

import Desktop from "./Desktop.svelte";

// `domicile load-shell` runs this again with the windows still open.
export const Shell = mountShell(Desktop, (domicile) => {
  if (domicile.windows.list.length === 0) {
    domicile.processes.launch(["kitty"]);
  }
});
