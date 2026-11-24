/**
 * A scrolling layout as niri has it: windows in columns on a strip, each
 * column a stack of windows with a width of its own. Pure functions over
 * window ids.
 */
export type Column = {
  readonly windows: readonly string[];
  /** A proportion of the view's width, gaps left out. */
  readonly width: number;
  /** Maximized: the view's whole width, over `width`, which it returns to. */
  readonly full: boolean;
};

export type Columns = readonly Column[];

export type Direction = "left" | "right" | "up" | "down";

/** A column of `windows` at `width`, not maximized. */
export const columnOfWidth = (windows: readonly string[], width: number): Column => ({ windows, width, full: false });

/** The column holding `id`, or -1. */
export const columnOf = (columns: Columns, id: string | undefined): number =>
  id === undefined ? -1 : columns.findIndex((column) => column.windows.includes(id));

/**
 * `columns` with closed windows dropped, emptied columns removed, and each new
 * window in `open` added as a column of its own, `width` wide, right after the
 * one holding `focused` (at the end when nothing is focused).
 */
export const sync = (
  columns: Columns,
  open: readonly string[],
  focused: string | undefined,
  width: number,
): Columns => {
  const kept = columns
    .map((column) => ({ ...column, windows: column.windows.filter((id) => open.includes(id)) }))
    .filter((column) => column.windows.length > 0);
  const placed = new Set(kept.flatMap((column) => column.windows));
  const added = open.filter((id) => !placed.has(id));
  const at = columnOf(kept, focused);
  const after = at === -1 ? kept.length : at + 1;
  return [...kept.slice(0, after), ...added.map((id) => columnOfWidth([id], width)), ...kept.slice(after)];
};

/**
 * The window to focus from `focused` in `direction`, or `undefined` at the
 * edge. Moving between columns keeps the row, clamped to the column's height.
 */
export const neighbor = (columns: Columns, focused: string | undefined, direction: Direction): string | undefined => {
  const at = columnOf(columns, focused);
  const column = columns[at]?.windows;
  if (column === undefined || focused === undefined) {
    return columns[0]?.windows[0];
  }
  const row = column.indexOf(focused);
  switch (direction) {
    case "up":
      return column[row - 1];
    case "down":
      return column[row + 1];
    case "left":
    case "right": {
      const next = columns[direction === "left" ? at - 1 : at + 1]?.windows;
      return next?.[Math.min(row, next.length - 1)];
    }
  }
};

/** The window in the first or last column, in the row `focused` is in. */
export const edge = (columns: Columns, focused: string | undefined, end: "first" | "last"): string | undefined => {
  const row = Math.max(0, columns[columnOf(columns, focused)]?.windows.indexOf(focused ?? "") ?? 0);
  const column = (end === "first" ? columns[0] : columns.at(-1))?.windows;
  return column?.[Math.min(row, column.length - 1)];
};

const without = (columns: Columns, id: string): Columns =>
  columns
    .map((column) => ({ ...column, windows: column.windows.filter((each) => each !== id) }))
    .filter((column) => column.windows.length > 0);

const insertAt = (columns: Columns, index: number, column: Column): Columns => [
  ...columns.slice(0, index),
  column,
  ...columns.slice(index),
];

/**
 * niri's consume-or-expel-window-left and -right. A window sharing its column
 * leaves it for a column of its own on that side, `width` wide; a window alone
 * joins the bottom of the column on that side. Nothing changes at the edge.
 */
export const consumeOrExpel = (columns: Columns, id: string, side: "left" | "right", width: number): Columns => {
  const at = columnOf(columns, id);
  const column = columns[at];
  if (column === undefined) {
    return columns;
  }
  if (column.windows.length > 1) {
    const rest = columns.map((each, index) =>
      index === at ? { ...each, windows: each.windows.filter((window) => window !== id) } : each,
    );
    return insertAt(rest, side === "left" ? at : at + 1, columnOfWidth([id], width));
  }
  const target = columns[side === "left" ? at - 1 : at + 1];
  if (target === undefined) {
    return columns;
  }
  return columns
    .filter((each) => each !== column)
    .map((each) => (each === target ? { ...each, windows: [...each.windows, id] } : each));
};

/** niri's consume-window-into-column: the next column's top window joins the bottom of `id`'s. */
export const consume = (columns: Columns, id: string): Columns => {
  const at = columnOf(columns, id);
  const taken = columns[at + 1]?.windows[0];
  if (at === -1 || taken === undefined) {
    return columns;
  }
  return without(columns, taken).map((each, index) =>
    index === at ? { ...each, windows: [...each.windows, taken] } : each,
  );
};

/** niri's expel-window-from-column: `id` leaves for a column of its own on the right. */
export const expel = (columns: Columns, id: string, width: number): Columns =>
  (columns[columnOf(columns, id)]?.windows.length ?? 0) > 1 ? consumeOrExpel(columns, id, "right", width) : columns;

/** `id`'s column moved one place left or right, or to the first or last place. */
export const moveColumn = (columns: Columns, id: string, to: "left" | "right" | "first" | "last"): Columns => {
  const at = columnOf(columns, id);
  const column = columns[at];
  if (column === undefined) {
    return columns;
  }
  const rest = columns.filter((_, index) => index !== at);
  const index = { left: Math.max(0, at - 1), right: Math.min(rest.length, at + 1), first: 0, last: rest.length }[to];
  return insertAt(rest, index, column);
};

/** `id` moved one place up or down in its column. */
export const moveWindow = (columns: Columns, id: string, direction: "up" | "down"): Columns =>
  columns.map((column) => {
    const row = column.windows.indexOf(id);
    const other = direction === "up" ? row - 1 : row + 1;
    const swapped = column.windows[other];
    if (row === -1 || swapped === undefined) {
      return column;
    }
    const windows = [...column.windows];
    windows[row] = swapped;
    windows[other] = id;
    return { ...column, windows };
  });

/** `id`'s column maximized, or back to its width. */
export const toggleFull = (columns: Columns, id: string): Columns =>
  columns.map((column) => (column.windows.includes(id) ? { ...column, full: !column.full } : column));

/**
 * niri's switch-preset-column-width: `id`'s column at the first of `presets`
 * wider than it is, or the first of them after the widest. It stops being
 * maximized.
 */
export const nextPreset = (columns: Columns, id: string, presets: readonly number[]): Columns =>
  columns.map((column) => {
    if (!column.windows.includes(id)) {
      return column;
    }
    const width = presets.find((preset) => preset > column.width + 1e-6) ?? presets[0] ?? column.width;
    return { ...column, width, full: false };
  });

export type Box = { x: number; y: number; width: number; height: number };

export type Span = { start: number; end: number };

export type Sizes = { view: number; gap: number; height: number };

/** Where each column starts and ends on the strip, before scrolling. */
export const spans = (columns: Columns, { view, gap }: Pick<Sizes, "view" | "gap">): Span[] => {
  let start = 0;
  return columns.map((column) => {
    const end = start + Math.max(0, column.full ? view : (view - gap) * column.width);
    const span = { start, end };
    start = end + gap;
    return span;
  });
};

/**
 * Each window's box on the strip, before scrolling: columns side by side,
 * windows in a column sharing `height`, `gap` apart.
 */
export const place = (columns: Columns, sizes: Sizes): Map<string, Box> => {
  const across = spans(columns, sizes);
  return new Map(
    columns.flatMap((column, index) => {
      const { start, end } = across[index] ?? { start: 0, end: 0 };
      const stack = column.windows;
      const each = Math.max(0, (sizes.height - sizes.gap * (stack.length - 1)) / stack.length);
      return stack.map((id, row): [string, Box] => [
        id,
        { x: start, y: row * (each + sizes.gap), width: end - start, height: each },
      ]);
    }),
  );
};

/** The strip's scroll offset that shows `span` whole, moving as little as possible from `scroll`. */
export const scrollTo = (scroll: number, span: Span, view: number): number => {
  if (span.start < scroll) {
    return span.start;
  }
  if (span.end > scroll + view) {
    return span.end - view;
  }
  return scroll;
};

/**
 * The scroll offset nearest `scroll` that shows no empty view past either end
 * of the strip: 0 when the strip is narrower than the view.
 */
export const filled = (scroll: number, across: readonly Span[], view: number): number =>
  Math.max(0, Math.min(scroll, (across.at(-1)?.end ?? 0) - view));

/** The strip's scroll offset that puts `span` in the middle of the view. */
export const center = (span: Span, view: number): number => (span.start + span.end) / 2 - view / 2;
