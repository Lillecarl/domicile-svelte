/**
 * A scrolling layout as niri has it: windows in columns on a strip, each
 * column a stack of windows. Pure functions over window ids.
 */
export type Columns = readonly (readonly string[])[];

export type Direction = "left" | "right" | "up" | "down";

/** The column holding `id`, or -1. */
export const columnOf = (columns: Columns, id: string | undefined): number =>
  id === undefined ? -1 : columns.findIndex((column) => column.includes(id));

/**
 * `columns` with closed windows dropped, emptied columns removed, and each new
 * window in `open` added as a column of its own right after the one holding
 * `focused` (at the end when nothing is focused).
 */
export const sync = (columns: Columns, open: readonly string[], focused: string | undefined): Columns => {
  const kept = columns
    .map((column) => column.filter((id) => open.includes(id)))
    .filter((column) => column.length > 0);
  const placed = new Set(kept.flat());
  const added = open.filter((id) => !placed.has(id));
  const at = columnOf(kept, focused);
  const after = at === -1 ? kept.length : at + 1;
  return [...kept.slice(0, after), ...added.map((id) => [id]), ...kept.slice(after)];
};

/**
 * The window to focus from `focused` in `direction`, or `undefined` at the
 * edge. Moving between columns keeps the row, clamped to the column's height.
 */
export const neighbor = (columns: Columns, focused: string | undefined, direction: Direction): string | undefined => {
  const at = columnOf(columns, focused);
  const column = columns[at];
  if (column === undefined || focused === undefined) {
    return columns[0]?.[0];
  }
  const row = column.indexOf(focused);
  switch (direction) {
    case "up":
      return column[row - 1];
    case "down":
      return column[row + 1];
    case "left":
    case "right": {
      const next = columns[direction === "left" ? at - 1 : at + 1];
      return next?.[Math.min(row, next.length - 1)];
    }
  }
};

/**
 * The strip's scroll offset that shows column `index` whole, moving as little
 * as possible from `scroll`.
 */
export const scrollTo = (
  scroll: number,
  index: number,
  { column, gap, view }: { column: number; gap: number; view: number },
): number => {
  const start = index * (column + gap);
  const end = start + column;
  if (start < scroll) {
    return start;
  }
  if (end > scroll + view) {
    return end - view;
  }
  return scroll;
};
