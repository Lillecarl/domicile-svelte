export type Item = {
  kind: "item";
  /** Unique in its menu. */
  key: string;
  label: string;
  enabled: boolean;
  /** An image URL. */
  image?: string | undefined;
  /** Its key, as text. */
  hint?: string | undefined;
  toggle?: { kind: "check" | "radio"; on: boolean } | undefined;
  submenu?: readonly Entry[] | undefined;
  run?: () => void;
  /** Its submenu is about to show. */
  onshow?: () => void;
};

export type Entry = Item | { kind: "separator"; key: string };

/** The items with the keys in `open`, each in the submenu of the one before. */
export const opened = (entries: readonly Entry[], open: readonly string[]): Item[] => {
  const [key, ...rest] = open;
  const item = itemOf(entries, key);
  return item?.submenu === undefined ? [] : [item, ...opened(item.submenu, rest)];
};

/** The entries of each menu on the screen, outermost first. */
export const levels = (entries: readonly Entry[], open: readonly string[]): (readonly Entry[])[] => [
  entries,
  ...opened(entries, open).map(({ submenu }) => submenu ?? []),
];

export const itemOf = (entries: readonly Entry[], key: string | undefined): Item | undefined =>
  entries.find((entry): entry is Item => entry.kind === "item" && entry.key === key);

/** The enabled item `by` places from `at`, around the ends; from none, the first or last. */
export const stepped = (entries: readonly Entry[], at: string | undefined, by: 1 | -1): string | undefined => {
  const keys = entries.filter((entry): entry is Item => entry.kind === "item" && entry.enabled).map(({ key }) => key);
  const index = at === undefined ? -1 : keys.indexOf(at);
  return index === -1 ? keys.at(by === 1 ? 0 : -1) : keys[(index + by + keys.length) % keys.length];
};

/** Where a menu `size` long starts, wanted at `at`, to end before `limit`. */
export const fitted = (at: number, size: number, limit: number): number => Math.max(0, Math.min(at, limit - size));

/** Where a submenu `width` wide starts: right of its row, or left of it where that does not fit. */
export const beside = (row: { left: number; right: number }, width: number, limit: number): number =>
  row.right + width <= limit ? row.right : Math.max(0, row.left - width);
