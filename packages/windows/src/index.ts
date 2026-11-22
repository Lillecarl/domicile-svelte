import type { Windows } from "@domicile-desktop/sdk/desktop/windows";

/**
 * Gives the keyboard to each top-level window as it opens, and to a window
 * that asks for it (xdg-activation). Returns a function that stops.
 *
 * Windows open when it starts are left alone, so reloading the shell does not
 * move the focus. Menus and tooltips have a parent and are never focused.
 */
export const focusNewWindows = (windows: Windows): (() => void) => {
  const seen = new Set(windows.list.map((window) => window.appId));
  const stopChange = windows.on("change", () => {
    const open = new Set(windows.list.map((window) => window.appId));
    for (const window of windows.list) {
      if (!seen.has(window.appId) && window.parent === undefined) {
        windows.focus(window.appId);
      }
    }
    seen.clear();
    for (const appId of open) {
      seen.add(appId);
    }
  });
  const stopRequest = windows.on("focusrequest", (appId) => windows.focus(appId));
  return () => {
    stopChange();
    stopRequest();
  };
};
