import type { WebViewPermission, WebViewPermissionSetting } from "@domicile-desktop/sdk/webview-element";
import type { Entry } from "@domicile-svelte/menu";

/** What each lets a site do, for "asks to …". */
const ASKS: Record<WebViewPermission, string> = {
  camera: "use your camera",
  microphone: "use your microphone",
  location: "know your location",
  notifications: "show notifications",
  clipboard: "read your clipboard",
  midi: "use your MIDI devices",
  "window-management": "manage windows on all your screens",
  "local-fonts": "list the fonts on this computer",
  "idle-detection": "know when you are idle",
  "automatic-downloads": "download several files",
};

const NAMES: Record<WebViewPermission, string> = {
  camera: "Camera",
  microphone: "Microphone",
  location: "Location",
  notifications: "Notifications",
  clipboard: "Clipboard",
  midi: "MIDI devices",
  "window-management": "Window management",
  "local-fonts": "Local fonts",
  "idle-detection": "Idle detection",
  "automatic-downloads": "Automatic downloads",
};

const SETTINGS: Record<WebViewPermissionSetting, string> = { ask: "Ask", allow: "Allow", block: "Block" };

const isPermission = (name: string): name is WebViewPermission => Object.hasOwn(ASKS, name);

const keysOf = <Key extends string>(record: Record<Key, unknown>) => Object.keys(record) as Key[];

/**
 * What a request asks, or `undefined` for one with a permission this shell
 * cannot name: the user would not know what they allow.
 */
export const asksTo = (permissions: readonly string[]): string | undefined =>
  permissions.length > 0 && permissions.every(isPermission)
    ? permissions.map((each) => ASKS[each]).join(" and ")
    : undefined;

/** A menu of the site's `settings` (`view.sitePermissions()`), or none for a page that has none. */
export const permissionMenu = (
  settings: Readonly<Record<string, string>>,
  set: (permission: WebViewPermission, setting: WebViewPermissionSetting) => void,
): Entry[] => {
  const known = keysOf(NAMES).filter((permission) => Object.hasOwn(settings, permission));
  return known.length === 0
    ? []
    : [
        {
          kind: "item",
          key: "permissions",
          label: "Site permissions",
          enabled: true,
          submenu: [
            ...known.map((permission): Entry => {
              const setting = settings[permission] ?? "ask";
              return {
                kind: "item",
                key: permission,
                label: NAMES[permission],
                enabled: true,
                hint: Object.hasOwn(SETTINGS, setting) ? SETTINGS[setting as WebViewPermissionSetting] : setting,
                submenu: keysOf(SETTINGS).map((choice): Entry => ({
                  kind: "item",
                  key: choice,
                  label: SETTINGS[choice],
                  enabled: true,
                  toggle: { kind: "radio", on: choice === setting },
                  run: () => set(permission, choice),
                })),
              };
            }),
            { kind: "separator", key: "reset-separator" },
            {
              kind: "item",
              key: "reset",
              label: "Reset all",
              // Also with nothing chosen: the engine then lets a site ask again
              // that Chrome blocked for unanswered requests.
              enabled: true,
              run: () => {
                for (const permission of known) {
                  set(permission, "ask");
                }
              },
            },
          ],
        },
      ];
};
