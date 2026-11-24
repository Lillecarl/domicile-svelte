import type { Notification } from "@domicile-desktop/sdk/notification";

type Stamp = Pick<Notification, "id" | "time">;

/** Tells a replaced notification, which keeps its id, from the one before it. */
export const keyOf = ({ id, time }: Stamp): string => `${id}:${time}`;

/** What is new in `now`, replaced ones included. The first list is history, so nothing in it is. */
export const arrivals = <Item extends Stamp>(before: readonly Stamp[] | undefined, now: readonly Item[]): Item[] => {
  if (before === undefined) {
    return [];
  }
  const known = new Set(before.map(keyOf));
  return now.filter((each) => !known.has(keyOf(each)));
};

const DEFAULT_MS = 6000;
const SHORTEST_MS = 2000;

/** How long a toast stays up; `undefined` is until it is dismissed. */
export const toastMs = ({ timeoutMs, urgency }: Pick<Notification, "timeoutMs" | "urgency">): number | undefined =>
  urgency === "critical" || timeoutMs === 0 ? undefined : Math.max(SHORTEST_MS, timeoutMs ?? DEFAULT_MS);

/** Whether a toast is shown at all. */
export const toasts = ({ urgency }: Pick<Notification, "urgency">, paused: boolean): boolean =>
  !paused || urgency === "critical";

export const unread = (list: readonly Stamp[], seen: number): number => list.filter(({ time }) => time > seen).length;

/** "now", "5 min", "3 h" or a date. */
export const ago = (time: number, now: Date): string => {
  const minutes = Math.floor((now.getTime() - time) / 60_000);
  if (minutes < 1) {
    return "now";
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  return minutes < 24 * 60 ? `${Math.floor(minutes / 60)} h` : new Date(time).toLocaleDateString();
};
