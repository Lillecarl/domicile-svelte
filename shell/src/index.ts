import { mountShell } from "@domicile-svelte/svelte";

import Desktop from "./Desktop.svelte";

export const Shell = mountShell(Desktop, (domicile) => domicile.processes.launch(["kitty"]));
