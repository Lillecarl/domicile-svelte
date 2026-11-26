/**
 * Native windows across an engine restart. The compositor numbers windows
 * from 1 each time it starts, so a saved key alone could name a new window:
 * a window is the same one only while its process is.
 */

/** A native window as it is saved: its key, and the process that opened it. */
export type SavedNative = {
  readonly key: string;
  readonly desktopId: string;
  readonly title: string;
  /** Undefined where the compositor knows none, and left out of the file. */
  readonly pid?: number | undefined;
  readonly pidfdInode?: number | undefined;
  /** The process's command line, empty while unread. */
  readonly argv: readonly string[];
};

/** A native window open now. */
export type OpenNative = Pick<SavedNative, "key" | "pid" | "pidfdInode">;

/** A window of the last session whose process is started again. */
export type Starting = { readonly key: string; readonly desktopId: string; readonly title: string };

/** The arguments in `/proc/<pid>/cmdline`. */
export const argvOf = (cmdline: Uint8Array): string[] => {
  const words = new TextDecoder().decode(cmdline).split("\0");
  return words.at(-1) === "" ? words.slice(0, -1) : words;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isId = (value: unknown) => value === undefined || typeof value === "number";

export const isSavedNative = (value: unknown): value is SavedNative =>
  isRecord(value) &&
  ["key", "desktopId", "title"].every((field) => typeof value[field] === "string") &&
  isId(value["pid"]) &&
  isId(value["pidfdInode"]) &&
  Array.isArray(value["argv"]) &&
  value["argv"].every((word) => typeof word === "string");

const sameProcess = (a: OpenNative, b: OpenNative) =>
  a.pid !== undefined && a.pid === b.pid && a.pidfdInode === b.pidfdInode;

/**
 * What becomes of each saved native window: its key while its process still
 * runs, as after a shell reload, or a window to wait for. One command per
 * process: a process opens its own windows again, or does not. A window
 * without a desktop id is not waited for, since nothing tells its new window
 * apart, but its process starts.
 */
export const relaunched = (
  saved: readonly SavedNative[],
  open: readonly OpenNative[],
): { keys: Map<string, string>; starting: Starting[]; commands: string[][] } => {
  const keys = new Map<string, string>();
  const starting: Starting[] = [];
  const commands: string[][] = [];
  const started: OpenNative[] = [];
  saved.forEach((window, at) => {
    if (open.some((each) => each.key === window.key && sameProcess(each, window))) {
      keys.set(window.key, window.key);
      return;
    }
    // A process that still runs, as over a shell reload, keeps what it has.
    if (window.argv.length === 0 || open.some((each) => sameProcess(each, window))) {
      return;
    }
    if (window.desktopId !== "") {
      const key = `starting:${at}`;
      keys.set(window.key, key);
      starting.push({ key, desktopId: window.desktopId, title: window.title });
    }
    if (!started.some((each) => sameProcess(each, window))) {
      started.push(window);
      commands.push([...window.argv]);
    }
  });
  return { keys, starting, commands };
};

/** The window `desktopId`'s new window takes the place of: the first asked for. */
export const claimed = (starting: readonly Starting[], desktopId: string): Starting | undefined =>
  desktopId === "" ? undefined : starting.find((each) => each.desktopId === desktopId);
