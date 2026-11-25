/**
 * The overview's geometry: the strip, and the parked windows in a row under
 * it, seen from further away. Pure functions, in the strip's own pixels, where
 * the first column starts at 0.
 */
import { type Box, type Columns, columnOf, columnOfWidth } from "./columns";

export type Size = { width: number; height: number };

/** Space between the strip and the parked row. */
export const ROW_GAP = 64;

/** As niri's, unless more has to fit. */
const LARGEST = 0.5;
/** Any smaller and no window can be told from another: the rest is panned to. */
const SMALLEST = 0.25;
/** The part of the view left empty around what is shown. */
const MARGIN = 0.05;

/** A row of `sizes` under a strip `strip` wide, centered on it. */
export const parkedRow = (
  sizes: ReadonlyMap<string, Size>,
  { strip, height, gap }: { strip: number; height: number; gap: number },
): Map<string, Box> => {
  const all = [...sizes];
  const total = all.reduce((sum, [, { width }]) => sum + width + gap, -gap);
  let x = (strip - total) / 2;
  return new Map(
    all.map(([key, size]): [string, Box] => {
      const box = { x, y: height + ROW_GAP, width: size.width, height: size.height };
      x += size.width + gap;
      return [key, box];
    }),
  );
};

/** What holds every box. */
export const boundsOf = (boxes: Iterable<Box>): Box => {
  const all = [...boxes];
  const x = Math.min(0, ...all.map((box) => box.x));
  const y = Math.min(0, ...all.map((box) => box.y));
  return {
    x,
    y,
    width: Math.max(0, ...all.map((box) => box.x + box.width)) - x,
    height: Math.max(0, ...all.map((box) => box.y + box.height)) - y,
  };
};

/** How much smaller `bounds` is drawn in `view`. */
export const zoomFor = (bounds: Box, view: Size): number => {
  const room = 1 - 2 * MARGIN;
  const across = (view.width * room) / Math.max(1, bounds.width);
  const down = (view.height * room) / Math.max(1, bounds.height);
  return Math.min(LARGEST, Math.max(SMALLEST, Math.min(across, down)));
};

/** `box` with its axes swapped, to pan up and down. */
export const turned = <T extends Partial<Box> & Size>(box: T): Box => ({
  x: box.y ?? 0,
  y: box.x ?? 0,
  width: box.height,
  height: box.width,
});

/** The place nearest `pan`, shown in the middle of the view, that leaves no more empty than it must. */
export const clampPan = (pan: number, bounds: Box, view: Pick<Size, "width">, zoom: number): number => {
  const half = (view.width * (0.5 - MARGIN)) / zoom;
  const [first, last] = [bounds.x + half, bounds.x + bounds.width - half];
  return first >= last ? bounds.x + bounds.width / 2 : Math.max(first, Math.min(last, pan));
};

/** `pan` moved as little as shows `box` whole. */
export const panTo = (pan: number, box: Box, view: Pick<Size, "width">, zoom: number): number => {
  const half = (view.width * (0.5 - MARGIN)) / zoom;
  return Math.max(box.x + box.width - half, Math.min(box.x + half, pan));
};

/** Where a dragged window goes, beside or in the column of another. */
export type Drop = { anchor: string; side: "left" | "right" | "above" | "below" };

/** The outer part of a column, on each side, that makes a column of its own. */
const EDGE = 0.25;

/** Where `id` goes when it is dropped at `point`; `undefined` leaves it where it is. */
export const dropAt = (
  columns: Columns,
  boxes: ReadonlyMap<string, Box>,
  id: string,
  point: { x: number; y: number },
): Drop | undefined => {
  const spans = columns.flatMap(({ windows }) => {
    const box = boxes.get(windows[0] ?? "");
    return box === undefined ? [] : [{ windows, start: box.x, end: box.x + box.width }];
  });
  // The first column the point is not past, or the last.
  const span = spans.find(({ end }) => point.x < end) ?? spans.at(-1);
  if (span === undefined) {
    return undefined;
  }
  const along = (point.x - span.start) / Math.max(1, span.end - span.start);
  if (along < EDGE || along > 1 - EDGE) {
    const anchor = span.windows.find((key) => key !== id);
    return anchor === undefined ? undefined : { anchor, side: along < EDGE ? "left" : "right" };
  }
  const anchor =
    span.windows.find((key) => {
      const box = boxes.get(key);
      return box !== undefined && point.y < box.y + box.height;
    }) ?? span.windows.at(-1);
  const box = anchor === undefined ? undefined : boxes.get(anchor);
  return anchor === undefined || box === undefined || anchor === id
    ? undefined
    : { anchor, side: point.y < box.y + box.height / 2 ? "above" : "below" };
};

/** `columns` with `id` dropped at `drop`. A window alone in its column keeps its column's width. */
export const dropped = (columns: Columns, id: string, { anchor, side }: Drop, width: number): Columns => {
  if (anchor === id || columnOf(columns, anchor) === -1) {
    return columns;
  }
  const own = columns[columnOf(columns, id)];
  const rest = columns
    .map((column) => ({ ...column, windows: column.windows.filter((each) => each !== id) }))
    .filter((column) => column.windows.length > 0);
  const at = columnOf(rest, anchor);
  if (side === "left" || side === "right") {
    const alone = own?.windows.length === 1 ? own : columnOfWidth([id], width);
    const index = side === "left" ? at : at + 1;
    return [...rest.slice(0, index), alone, ...rest.slice(index)];
  }
  return rest.map((column, index) => {
    if (index !== at) {
      return column;
    }
    const row = column.windows.indexOf(anchor) + (side === "below" ? 1 : 0);
    return { ...column, windows: [...column.windows.slice(0, row), id, ...column.windows.slice(row)] };
  });
};

/** Where `drop` is marked: a line beside or between windows. */
export const markOf = (
  columns: Columns,
  boxes: ReadonlyMap<string, Box>,
  { anchor, side }: Drop,
  gap: number,
): Box | undefined => {
  const box = boxes.get(anchor);
  if (box === undefined) {
    return undefined;
  }
  switch (side) {
    case "above":
      return { x: box.x, y: box.y - gap, width: box.width, height: gap };
    case "below":
      return { x: box.x, y: box.y + box.height, width: box.width, height: gap };
    case "left":
    case "right": {
      const stack = boundsOf(
        (columns[columnOf(columns, anchor)]?.windows ?? []).flatMap((key) => boxes.get(key) ?? []),
      );
      const x = side === "left" ? box.x - gap : box.x + box.width;
      return { x, y: stack.y, width: gap, height: stack.height };
    }
  }
};
