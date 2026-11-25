import type { Box, ClientWindow, Windows } from "@domicile-desktop/sdk/desktop/windows";

/** The focused window whose client asks to lock the pointer, which the compositor offers under the pointer alone. */
export const lockFor = (list: readonly ClientWindow[], focused: string | undefined): string | undefined =>
  list.find((window) => window.appId === focused && window.pointerConstraint === "lock")?.appId;

/** The focused window whose client asks to keep the pointer in it. */
export const confineFor = (list: readonly ClientWindow[], focused: string | undefined): ClientWindow | undefined =>
  list.find((window) => window.appId === focused && window.pointerConstraint === "confine");

type Confined = Pick<ClientWindow, "height" | "width"> & { readonly pointerRegion: readonly Box[] | undefined };

/** Where `window`, drawn at `at`, keeps the pointer: its region, in the page, or all of it. */
export const confinedTo = ({ height, pointerRegion, width }: Confined, at: Box): Box[] => {
  if (at.width <= 0 || at.height <= 0) {
    return [];
  }
  if (pointerRegion === undefined) {
    return [at];
  }
  // A client that has drawn nothing has no size yet.
  const across = width ? at.width / width : 1;
  const down = height ? at.height / height : 1;
  return pointerRegion.flatMap((box) => {
    const left = Math.max(at.x, at.x + box.x * across);
    const top = Math.max(at.y, at.y + box.y * down);
    const right = Math.min(at.x + at.width, at.x + (box.x + box.width) * across);
    const bottom = Math.min(at.y + at.height, at.y + (box.y + box.height) * down);
    return right > left && bottom > top ? [{ x: left, y: top, width: right - left, height: bottom - top }] : [];
  });
};

const appOf = (element: Element | null): string | undefined =>
  element?.localName === "app" ? (element.getAttribute("app-id") ?? undefined) : undefined;

/**
 * Locks the pointer for the focused window that asks for it, until it loses
 * the keyboard. Escape does not end a lock, as games use it; a chord that
 * moves the keyboard does. Returns a function that stops.
 */
export const followPointerLock = (
  windows: Pick<Windows, "focused" | "list" | "on" | "pointerConstrained">,
): (() => void) => {
  // The window told that it holds the pointer.
  let held: string | undefined;
  const sync = () => {
    const wanted = lockFor(windows.list, windows.focused);
    const locked = appOf(document.pointerLockElement);
    if (locked !== undefined && locked !== wanted) {
      document.exitPointerLock();
    } else if (wanted !== undefined && locked === undefined) {
      const element = [...document.querySelectorAll("app")].find((app) => appOf(app) === wanted);
      // Refused, nothing is held, and the next change asks again.
      element?.requestPointerLock().catch(() => undefined);
    }
  };
  // The page's word for what it holds, as a request may be refused.
  const changed = () => {
    const locked = appOf(document.pointerLockElement);
    if (held !== undefined && held !== locked) {
      windows.pointerConstrained(held, false);
    }
    if (locked !== undefined && locked !== held) {
      windows.pointerConstrained(locked, true);
    }
    held = locked;
    sync();
  };
  const stops = [windows.on("change", sync), windows.on("focuschange", sync)];
  document.addEventListener("pointerlockchange", changed);
  sync();
  return () => {
    for (const stop of stops) {
      stop();
    }
    document.removeEventListener("pointerlockchange", changed);
    if (appOf(document.pointerLockElement) !== undefined) {
      document.exitPointerLock();
    }
    if (held !== undefined) {
      windows.pointerConstrained(held, false);
    }
  };
};
