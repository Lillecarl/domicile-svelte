import type { Notification } from "@domicile-desktop/sdk/notification";

/** How the history lists its notifications. */
export type Grouping = "newest" | "app";

/** One app's notifications, newest first. `app` is empty for a sender that gave no name. */
export type AppGroup<Item> = { app: string; notifications: Item[] };

/**
 * `history`, newest first, in one group per app, the groups ordered by their
 * newest notification.
 */
export const byApp = <Item extends Pick<Notification, "appName">>(history: readonly Item[]): AppGroup<Item>[] => {
  const groups = new Map<string, Item[]>();
  for (const each of history) {
    const group = groups.get(each.appName);
    if (group === undefined) {
      groups.set(each.appName, [each]);
    } else {
      group.push(each);
    }
  }
  return [...groups].map(([app, notifications]) => ({ app, notifications }));
};
