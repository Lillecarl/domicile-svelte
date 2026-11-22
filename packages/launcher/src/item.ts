/** One row of the launcher. */
export type Item = {
  /** Unique across every source the launcher shows. */
  key: string;
  label: string;
  detail?: string;
  run: () => void | Promise<void>;
};

/** Where rows come from: an app list, the windows, the web. */
export type Source = {
  /** The rows for `query`, best first. */
  search: (query: string) => Item[];
};

/**
 * `items` whose texts hold every word of `query`, case-insensitively, best
 * first: those whose first text starts with the query, then the rest, each in
 * their given order. A blank query keeps every item.
 */
export const matching = <T>(items: readonly T[], query: string, texts: (item: T) => readonly string[]): T[] => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const start = words.join(" ");
  const found = items
    .map((item) => texts(item).map((text) => text.toLowerCase()))
    .map((lowered, index) => ({ index, lowered }))
    .filter(({ lowered }) => words.every((word) => lowered.some((text) => text.includes(word))));
  const first = (lowered: readonly string[]) => Number(!(lowered[0] ?? "").startsWith(start));
  return found.sort((a, b) => first(a.lowered) - first(b.lowered) || a.index - b.index).map(({ index }) => items[index] as T);
};
