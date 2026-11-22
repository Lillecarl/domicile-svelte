import type { Domicile } from "@domicile-desktop/sdk/shell";
import { readIconTheme } from "@domicile-desktop/sdk/icon-theme";
import { appIcons, type IconLookup } from "@domicile-desktop/system-apps/app-icons";
import { dataDirs } from "@domicile-desktop/system-apps/data-dirs";
import type { DesktopEntry } from "@domicile-desktop/system-apps/desktop-entry";
import { findApps } from "@domicile-desktop/system-apps/find-apps";
import { installedApps } from "@domicile-desktop/system-apps/installed";

import type { Item, Source } from "./item";

export type InstalledSource = Source & {
  reload: () => Promise<void>;
  /** A theme icon's URL by name, once looked up; asks for it on first use. */
  icon: (name: string | undefined) => string | undefined;
  /** The icon of the app whose desktop file ID is `id`, such as a window's. */
  appIcon: (id: string) => string | undefined;
};

/**
 * The installed applications, from their desktop entries, with their icons
 * in the desktop's icon theme. `reload` reads them again, so a launcher
 * opened after an install shows it; the old list serves until the read ends.
 * system-apps 1.2.0 leaves out `Terminal` entries.
 */
export const installedSource = (domicile: Domicile): InstalledSource => {
  let entries = $state<DesktopEntry[]>([]);
  // A lookup reads each theme once and each name once: kept while the
  // directories and the theme stay.
  let lookup = $state.raw<{ find: IconLookup; at: string }>();
  // `null` for a name the theme has no usable icon for.
  let icons = $state<Record<string, string | null>>({});
  let asked = new Set<string>();

  const reload = async () => {
    const [dirs, theme] = await Promise.all([dataDirs(domicile), readIconTheme(domicile)]);
    const themeName = theme.match({
      Ok: (found) => found.match({ Some: (name) => name, None: () => undefined }),
      Err: (error) => {
        console.error("[launcher] reading the icon theme:", error);
        return undefined;
      },
    });
    dirs.match({
      Ok: (found) => {
        const at = JSON.stringify([found, themeName]);
        if (lookup?.at !== at) {
          asked = new Set();
          icons = {};
          lookup = { find: appIcons(domicile, found, ["apps"], { theme: themeName }), at };
        }
      },
      Err: () => undefined,
    });
    const read = await dirs.andThenAsync((found) => installedApps(domicile, found));
    read.match({
      Ok: (found) => {
        entries = found.sort((a, b) => a.name.localeCompare(b.name));
      },
      Err: (error) => console.error("[launcher] reading desktop entries:", error),
    });
  };

  const icon = (name: string | undefined) => {
    if (name === undefined || lookup === undefined) {
      return undefined;
    }
    if (!asked.has(name)) {
      asked.add(name);
      const { find } = lookup;
      find(name)
        .then((found) =>
          found.match({
            Ok: (url) => {
              if (lookup?.find === find) {
                icons[name] = url.match({ Some: (data) => data, None: () => null });
              }
            },
            Err: (error) => console.error("[launcher] icon", name, error),
          }),
        )
        .catch((error: unknown) => console.error("[launcher] icon", name, error));
    }
    return icons[name] ?? undefined;
  };

  const appIcon = (id: string) =>
    icon(entries.find((entry) => entry.id === id || entry.id === `${id}.desktop`)?.icon);

  const item = (entry: DesktopEntry): Item => ({
    key: `app:${entry.id}`,
    label: entry.name,
    detail: entry.comment,
    icon: icon(entry.icon),
    run: () => domicile.processes.launch(entry.command),
  });

  return {
    reload,
    icon,
    appIcon,
    search: (query) => (query.trim() === "" ? entries : findApps(entries, query, 50)).map(item),
  };
};
