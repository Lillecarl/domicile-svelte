/**
 * The file the session is kept in. Not localStorage, which the engine writes
 * to disk about once a minute: a crash would lose the last changes.
 *
 * File calls are refused while the desktop is locked, so each waits for it to
 * unlock.
 */
import type { Files } from "@domicile-desktop/sdk/desktop/files";
import type { Session } from "@domicile-desktop/sdk/desktop/session";
import { type SystemError, SystemErrorKind } from "@domicile-desktop/sdk/system";

// Each made in turn: a call makes one directory.
const DIRECTORIES = [".local", ".local/state", ".local/state/domicile-svelte"];
const PATH = `${DIRECTORIES.at(-1)}/session.json`;

type Kept = Pick<Files, "createDir" | "readText" | "write">;
type Lock = Pick<Session, "locked" | "on">;

const unlocked = (lock: Lock): Promise<void> =>
  lock.locked === false
    ? Promise.resolve()
    : new Promise((resolve) => {
        const stop = lock.on("lockchange", () => {
          if (lock.locked === false) {
            stop();
            resolve();
          }
        });
      });

/** The saved text, or `null` for none. Throws for a file that cannot be read. */
export const readSession = async (files: Kept, lock: Lock): Promise<string | null> => {
  for (;;) {
    await unlocked(lock);
    const read = (await files.readText(PATH)).match<{ text: string | null } | { error: SystemError }>({
      Ok: (text) => ({ text }),
      Err: (error) => (error.kind === SystemErrorKind.NotFound ? { text: null } : { error }),
    });
    if ("text" in read) {
      return read.text;
    }
    if (read.error.kind !== SystemErrorKind.Locked) {
      throw new Error(`${PATH}: ${read.error.message}`);
    }
  }
};

/** A writer of `text` last asked for, one write at a time. */
export const sessionWriter = (files: Kept, lock: Lock, failed: (error: unknown) => void): ((text: string) => void) => {
  let wanted: string | undefined;
  let written: string | undefined;
  let running = false;

  const write = async (text: string): Promise<void> => {
    const outcome = async () =>
      (await files.write(PATH, text)).match<SystemError | undefined>({ Ok: () => undefined, Err: (error) => error });
    let error = await outcome();
    if (error?.kind === SystemErrorKind.NotFound) {
      for (const directory of DIRECTORIES) {
        // Those there already fail, and a real failure fails the write too.
        await files.createDir(directory);
      }
      error = await outcome();
    }
    if (error === undefined) {
      written = text;
    } else if (error.kind !== SystemErrorKind.Locked) {
      // Not again until something changes.
      written = text;
      failed(new Error(`${PATH}: ${error.message}`));
    }
  };

  const run = async (): Promise<void> => {
    running = true;
    try {
      while (wanted !== undefined && wanted !== written) {
        await unlocked(lock);
        await write(wanted);
      }
    } finally {
      running = false;
    }
  };

  return (text) => {
    wanted = text;
    if (!running) {
      run().catch(failed);
    }
  };
};
