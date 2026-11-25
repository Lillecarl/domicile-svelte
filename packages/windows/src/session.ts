/**
 * The browser windows and the columns, as kept across a restart. Browser
 * windows' ids are no use here: the engine counts them from 1 each time it
 * starts. A native window's key is for the shell reload it is open over.
 */
import { type Columns, columnOf } from "./columns";

/** A page to open again. */
export type SavedPage = {
  readonly url: string;
  readonly title: string;
  readonly profile: string;
  readonly isApp: boolean;
  readonly appId: string;
};

type SavedColumn = {
  readonly windows: readonly (number | string)[];
  readonly width: number;
  readonly full: boolean;
};

/** Windows are indexes into `pages`, or a native window's key. */
export type Session = {
  readonly pages: readonly SavedPage[];
  readonly workspaces: readonly (readonly SavedColumn[])[];
  /** The workspace shown. */
  readonly at: number;
  readonly parked: readonly number[];
};

/** A saved page with no window yet. */
export type Asleep = SavedPage & { readonly key: string };

/** What a browser window says of itself. */
export type Page = {
  readonly url: string;
  readonly title: string;
  readonly profile?: string | undefined;
  readonly isApp: boolean;
  readonly appId: string;
  readonly isPrivate: boolean;
  readonly partition: string;
  readonly popupWindow?: number | undefined;
  readonly width: number;
  readonly height: number;
};

const KEPT = new Set(["http:", "https:", "chrome-extension:", "file:"]);

/**
 * `page` as it is saved, or `undefined` for one that is not: a private page,
 * a popup, a page with storage of its own, an Electron app's (it has no
 * profile), and one whose address opens nothing again.
 */
export const savedOf = (page: Page): SavedPage | undefined => {
  const { url, title, profile, isApp, appId } = page;
  const kept =
    !page.isPrivate &&
    page.partition === "" &&
    page.popupWindow === undefined &&
    page.width === 0 &&
    page.height === 0 &&
    URL.canParse(url) &&
    KEPT.has(new URL(url).protocol);
  return kept && profile !== undefined ? { url, title, profile, isApp, appId } : undefined;
};

export const sessionOf = (
  pages: readonly Asleep[],
  native: readonly string[],
  strips: { readonly workspaces: readonly Columns[]; readonly at: number },
  parked: readonly string[],
): Session => {
  const index = new Map(pages.map(({ key }, at) => [key, at]));
  const indexes = (keys: readonly string[]) =>
    keys.flatMap((key) => {
      const at = index.get(key);
      return at === undefined ? [] : [at];
    });
  return {
    pages: pages.map(({ url, title, profile, isApp, appId }) => ({ url, title, profile, isApp, appId })),
    workspaces: strips.workspaces.map((columns) =>
      columns
        .map(({ windows, width, full }) => ({
          windows: windows.flatMap((key): (number | string)[] => (native.includes(key) ? [key] : indexes([key]))),
          width,
          full,
        }))
        .filter(({ windows }) => windows.length > 0),
    ),
    at: strips.at,
    parked: indexes(parked),
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isSavedPage = (value: unknown): value is SavedPage =>
  isRecord(value) &&
  ["url", "title", "profile", "appId"].every((field) => typeof value[field] === "string") &&
  typeof value["isApp"] === "boolean";

/** The session in `text`, or `undefined` for none. */
export const parseSession = (text: string | null): Session | undefined => {
  let value: unknown;
  try {
    value = JSON.parse(text ?? "null");
  } catch {
    return undefined;
  }
  if (!isRecord(value)) {
    return undefined;
  }
  // A session saved without workspaces has one.
  const { pages, columns, workspaces = [columns], at = 0, parked } = value;
  if (
    !Array.isArray(pages) ||
    !pages.every(isSavedPage) ||
    !Array.isArray(workspaces) ||
    !Array.isArray(parked) ||
    typeof at !== "number"
  ) {
    return undefined;
  }
  const isIndex = (at: unknown) => typeof at === "number" && at in pages;
  const isColumn = (column: unknown) =>
    isRecord(column) &&
    Array.isArray(column["windows"]) &&
    column["windows"].every((each) => typeof each === "string" || isIndex(each)) &&
    typeof column["width"] === "number" &&
    column["width"] > 0 &&
    typeof column["full"] === "boolean";
  const isStrip = (strip: unknown) => Array.isArray(strip) && strip.every(isColumn);
  return workspaces.every(isStrip) && parked.every(isIndex) ? { pages, workspaces, at, parked } : undefined;
};

/** The sleeping page `page` is: an app by its id, any other by its address. */
export const sleeperOf = <T extends SavedPage>(asleep: readonly T[], page: SavedPage): T | undefined =>
  asleep.find(
    (each) =>
      each.profile === page.profile &&
      each.isApp === page.isApp &&
      each.appId === page.appId &&
      (each.url === page.url || (each.isApp && each.appId !== "")),
  );

/**
 * `session` among the windows open already (after a shell reload, all of
 * them): those keep their keys, and every other page sleeps under a key of
 * its own.
 */
export const restored = (
  session: Session,
  open: readonly { readonly key: string; readonly page: SavedPage }[],
  native: readonly string[] = [],
): { asleep: Asleep[]; workspaces: Columns[]; at: number; parked: string[] } => {
  const keys: (string | undefined)[] = session.pages.map(() => undefined);
  const adopt = (same: (saved: SavedPage, page: SavedPage) => boolean) => {
    for (const { key, page } of open) {
      const at = keys.includes(key)
        ? -1
        : session.pages.findIndex((saved, index) => keys[index] === undefined && same(saved, page));
      if (at !== -1) {
        keys[at] = key;
      }
    }
  };
  // Exact ones first, or one window of an app could take another's place.
  adopt((saved, page) => saved.url === page.url && sleeperOf([saved], page) !== undefined);
  adopt((saved, page) => sleeperOf([saved], page) !== undefined);
  const keyed = (at: number) => keys[at] ?? `asleep:${at}`;
  return {
    asleep: session.pages.flatMap((page, at) => (keys[at] === undefined ? [{ ...page, key: keyed(at) }] : [])),
    workspaces: session.workspaces.map((columns) =>
      columns
        .map(({ windows, width, full }) => ({
          windows: windows.flatMap((each) =>
            typeof each === "number" ? [keyed(each)] : native.includes(each) ? [each] : [],
          ),
          width,
          full,
        }))
        .filter(({ windows }) => windows.length > 0),
    ),
    at: session.at,
    parked: session.parked.map(keyed),
  };
};

/** `columns` with window `from` in its place known as `to`. */
export const renamed = (columns: Columns, from: string, to: string): Columns =>
  columnOf(columns, from) === -1
    ? columns
    : columns
        // `to` may have a column of its own already.
        .map((column) => ({ ...column, windows: column.windows.filter((key) => key !== to) }))
        .filter(({ windows }) => windows.length > 0)
        .map((column) => ({ ...column, windows: column.windows.map((key) => (key === from ? to : key)) }));
