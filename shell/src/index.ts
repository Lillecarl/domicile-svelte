import { mountShell } from "@domicile-svelte/svelte";

import Desktop from "./Desktop.svelte";

// The first kitty comes from domicile.json's startup.commands: this module
// runs again on every load-shell.
export const Shell = mountShell(Desktop);
