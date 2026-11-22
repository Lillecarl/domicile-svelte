import type { Domicile } from "@domicile-desktop/sdk/shell";
import { dataDirs } from "@domicile-desktop/system-apps/data-dirs";
import type { DesktopEntry } from "@domicile-desktop/system-apps/desktop-entry";
import { findApps } from "@domicile-desktop/system-apps/find-apps";
import { installedApps } from "@domicile-desktop/system-apps/installed";

import type { Item, Source } from "./item";

/**
 * The installed applications, from their desktop entries. `reload` reads them
 * again, so a launcher opened after an install shows it; the old list serves
 * until the read ends. system-apps 1.2.0 leaves out `Terminal` entries.
 */
export const installedSource = (domicile: Domicile): Source & { reload: () => Promise<void> } => {
  let entries = $state<DesktopEntry[]>([]);

  const reload = async () => {
    const dirs = await dataDirs(domicile);
    const read = await dirs.andThenAsync((found) => installedApps(domicile, found));
    read.match({
      Ok: (found) => {
        entries = found.sort((a, b) => a.name.localeCompare(b.name));
      },
      Err: (error) => console.error("[launcher] reading desktop entries:", error),
    });
  };

  const item = (entry: DesktopEntry): Item => ({
    key: `app:${entry.id}`,
    label: entry.name,
    detail: entry.comment,
    run: () => domicile.processes.launch(entry.command),
  });

  return {
    reload,
    search: (query) => (query.trim() === "" ? entries : findApps(entries, query, 50)).map(item),
  };
};
