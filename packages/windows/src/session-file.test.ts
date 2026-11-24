import { Err, Ok, type Result } from "@cprussin/option-result";
import type { SystemError } from "@domicile-desktop/sdk/system";
import { SystemErrorKind } from "@domicile-desktop/sdk/system";
import { expect, test } from "bun:test";

import { readSession, sessionWriter } from "./session-file";

const PATH = ".local/state/domicile-svelte/session.json";

// A home of files, and a lock that refuses them.
const desk = () => {
  const state = {
    locked: false as boolean | undefined,
    files: new Map<string, string>(),
    directories: new Set<string>(),
    writes: [] as string[],
    broken: false,
  };
  const listeners = new Set<() => void>();
  const refused = <T extends string>(): Result<T, SystemError> | undefined =>
    state.locked === false ? undefined : Err({ kind: SystemErrorKind.Locked, message: "locked" });
  const missing = { kind: SystemErrorKind.NotFound, message: "no such file" };
  const files = {
    readText: async (path: string): Promise<Result<string, SystemError>> => {
      const text = state.files.get(path);
      return (
        refused() ??
        (state.broken
          ? Err({ kind: SystemErrorKind.PermissionDenied, message: "denied" })
          : text === undefined
            ? Err(missing)
            : Ok(text))
      );
    },
    write: async (path: string, data: Uint8Array | string): Promise<Result<"written", SystemError>> => {
      const no = refused<"written">();
      if (no !== undefined) {
        return no;
      }
      if (!state.directories.has(path.slice(0, path.lastIndexOf("/")))) {
        return Err(missing);
      }
      state.files.set(path, String(data));
      state.writes.push(String(data));
      return Ok("written" as const);
    },
    createDir: async (path: string): Promise<Result<"created", SystemError>> => {
      state.directories.add(path);
      return Ok("created" as const);
    },
  };
  const lock = {
    get locked() {
      return state.locked;
    },
    on: (_event: string, listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const setLocked = (locked: boolean) => {
    state.locked = locked;
    for (const listener of [...listeners]) {
      listener();
    }
  };
  // The fakes have only what is called.
  return { state, files: files as never, lock: lock as never, setLocked };
};
const settled = () => new Promise((resolve) => setTimeout(resolve, 5));
const thrown = (error: unknown) => {
  throw error;
};

test("no file is no session", async () => {
  const { files, lock } = desk();
  expect(await readSession(files, lock)).toBeNull();
});

test("a file that cannot be read is an error, not an empty session", async () => {
  const { state, files, lock } = desk();
  state.broken = true;
  expect(readSession(files, lock)).rejects.toThrow("denied");
});

test("a locked desk is read once it unlocks", async () => {
  const { state, files, lock, setLocked } = desk();
  state.files.set(PATH, "kept");
  state.locked = undefined;
  const reading = readSession(files, lock);
  await settled();
  setLocked(true);
  await settled();
  setLocked(false);
  expect(await reading).toBe("kept");
});

test("the first write makes the directories", async () => {
  const { state, files, lock } = desk();
  sessionWriter(files, lock, thrown)("one");
  await settled();
  expect(state.files.get(PATH)).toBe("one");
});

test("what is asked for while it writes, or is locked, is written once, the last alone", async () => {
  const { state, files, lock, setLocked } = desk();
  state.directories.add(".local/state/domicile-svelte");
  const write = sessionWriter(files, lock, thrown);
  setLocked(true);
  write("one");
  write("two");
  write("three");
  await settled();
  expect(state.writes).toEqual([]);
  setLocked(false);
  await settled();
  write("three");
  await settled();
  expect(state.writes).toEqual(["three"]);
});
