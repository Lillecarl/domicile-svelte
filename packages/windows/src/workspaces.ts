/**
 * Workspaces as niri has them, one under the other: strips of columns, always
 * an empty one at the end. Pure functions over window keys.
 */
import { type Box, type Columns, columnOf, columnOfWidth, place, type Sizes, spans, sync } from "./columns";
import { type Drop, dropped } from "./overview";

export type Workspace = {
  readonly id: number;
  readonly columns: Columns;
  /** Its floating windows. */
  readonly floating: readonly string[];
};

export type Workspaces = readonly Workspace[];

export const emptyWorkspace = (id: number): Workspace => ({ id, columns: [], floating: [] });

export const isEmpty = ({ columns, floating }: Workspace): boolean => columns.length === 0 && floating.length === 0;

/** The id of the workspace holding `key`. */
export const workspaceOf = (workspaces: Workspaces, key: string | undefined): number | undefined =>
  key === undefined
    ? undefined
    : workspaces.find(({ columns, floating }) => columnOf(columns, key) !== -1 || floating.includes(key))?.id;

export const windowsOf = ({ columns, floating }: Workspace): string[] => [
  ...columns.flatMap(({ windows }) => windows),
  ...floating,
];

export const mapColumns = (workspaces: Workspaces, id: number, change: (columns: Columns) => Columns): Workspaces =>
  workspaces.map((each) => (each.id === id ? { ...each, columns: change(each.columns) } : each));

/** `workspaces` without the empty ones that are neither `current` nor the last, and with an empty one at the end. */
export const tidied = (workspaces: Workspaces, current: number): Workspaces => {
  const end = workspaces.at(-1);
  const kept = workspaces.filter((each) => each === end || each.id === current || !isEmpty(each));
  return end !== undefined && isEmpty(end)
    ? kept
    : [...kept, emptyWorkspace(Math.max(0, ...workspaces.map(({ id }) => id)) + 1)];
};

/**
 * `workspaces` with closed windows dropped. A window in none of them goes to
 * workspace `at`: beside `focused`, or floating.
 */
export const synced = (
  workspaces: Workspaces,
  open: { readonly tiled: readonly string[]; readonly floating: readonly string[] },
  at: number,
  focused: string | undefined,
  width: number,
): Workspaces => {
  const placed = new Set(workspaces.flatMap(windowsOf));
  return workspaces.map((each) => {
    const own = new Set(windowsOf(each));
    const mine = (key: string) => own.has(key) || (each.id === at && !placed.has(key));
    return {
      ...each,
      columns: sync(each.columns, open.tiled.filter(mine), focused, width),
      floating: open.floating.filter(mine),
    };
  });
};

const without = (workspaces: Workspaces, keys: readonly string[]): Workspaces =>
  workspaces.map((each) => ({
    ...each,
    columns: each.columns
      .map((column) => ({ ...column, windows: column.windows.filter((key) => !keys.includes(key)) }))
      .filter(({ windows }) => windows.length > 0),
    floating: each.floating.filter((key) => !keys.includes(key)),
  }));

/**
 * `key`, or its whole column, moved to workspace `to`: a column of its own
 * after the one holding `after`, or at the end.
 */
export const movedTo = (
  workspaces: Workspaces,
  key: string,
  to: number,
  what: "column" | "window",
  after: string | undefined,
): Workspaces => {
  const from = workspaces.find(({ id }) => id === workspaceOf(workspaces, key));
  if (from === undefined || from.id === to || !workspaces.some(({ id }) => id === to)) {
    return workspaces;
  }
  if (from.floating.includes(key)) {
    return without(workspaces, [key]).map((each) =>
      each.id === to ? { ...each, floating: [...each.floating, key] } : each,
    );
  }
  const column = from.columns[columnOf(from.columns, key)];
  if (column === undefined) {
    return workspaces;
  }
  const moved = what === "column" ? column : { ...column, windows: [key] };
  return mapColumns(without(workspaces, moved.windows), to, (columns) => {
    const at = columnOf(columns, after);
    const index = at === -1 ? columns.length : at + 1;
    return [...columns.slice(0, index), moved, ...columns.slice(index)];
  });
};

/** `key` dropped at `drop`, in any workspace, or into workspace `drop`. */
export const droppedIn = (workspaces: Workspaces, key: string, drop: Drop | number, width: number): Workspaces => {
  if (typeof drop === "number") {
    return movedTo(workspaces, key, drop, "window", undefined);
  }
  const to = workspaceOf(workspaces, drop.anchor);
  const from = workspaces.find(({ id }) => id === workspaceOf(workspaces, key));
  if (to === undefined || from === undefined || drop.anchor === key) {
    return workspaces;
  }
  if (from.id === to) {
    return mapColumns(workspaces, to, (columns) => dropped(columns, key, drop, width));
  }
  // Its column goes with it, so it keeps its width where it has a column of its own.
  const column = from.columns[columnOf(from.columns, key)] ?? columnOfWidth([key], width);
  return mapColumns(without(workspaces, [key]), to, (columns) =>
    dropped([...columns, { ...column, windows: [key] }], key, drop, width),
  );
};

export type Row = { readonly y: number; readonly height: number };

/** Where each workspace is, down from `current`. An empty one is `empty` high. */
export const rowsOf = (
  workspaces: Workspaces,
  current: number,
  { height, gap, empty }: { height: number; gap: number; empty: number },
): Map<number, Row> => {
  let y = 0;
  const rows = workspaces.map((each): [number, Row] => {
    const row = { y, height: isEmpty(each) ? empty : height };
    y += row.height + gap;
    return [each.id, row];
  });
  const start = rows.find(([id]) => id === current)?.[1].y ?? 0;
  return new Map(rows.map(([id, row]) => [id, { ...row, y: row.y - start }]));
};

/** The row `y` is in or nearest above. */
export const rowAt = (rows: ReadonlyMap<number, Row>, y: number): number | undefined =>
  [...rows].findLast(([, row]) => row.y <= y)?.[0] ?? [...rows][0]?.[0];

/** Each window's box, `shift` of its workspace over and its row down. */
export const placeAll = (
  workspaces: Workspaces,
  sizes: Sizes,
  rows: ReadonlyMap<number, Row>,
  shift: (id: number) => number,
): Map<string, Box> =>
  new Map(
    workspaces.flatMap(({ id, columns }) =>
      [...place(columns, sizes)].map(([key, box]): [string, Box] => [
        key,
        { ...box, x: box.x + shift(id), y: box.y + (rows.get(id)?.y ?? 0) },
      ]),
    ),
  );

/** How wide the widest strip is. */
export const widest = (workspaces: Workspaces, sizes: Pick<Sizes, "view" | "gap">): number =>
  Math.max(0, ...workspaces.map(({ columns }) => spans(columns, sizes).at(-1)?.end ?? 0));
