<!--
  Windows in columns on a strip that scrolls to keep the focused column in
  view, as niri lays them out. Native windows and browser windows tile
  alike; a browser window that asked for a size (an extension's popup window,
  a page's sized window.open) floats over the strip at that size.

  A parked window keeps running off the strip, as a background tab does, until
  `show` brings it back beside the active window.

  Bind keys to `move`, `close`, `park`, `refocus` and niri's column actions
  (`consumeOrExpel`, `maximize`, `cycleWidth` and the rest); `listing` and
  `show` serve a window switcher. `toggleOverview` draws it all smaller, parked
  windows too, to pick and move windows in.

  The strips are in workspaces, one under the other, as niri's: `focusWorkspace`
  and `moveToWorkspace`.
-->
<script lang="ts" module>
  /** A window as a switcher lists it. */
  export type Listed = {
    key: string;
    title: string;
    /** The desktop file ID; an app window's app id; "browser" for another browser window. */
    app: string;
    parked: boolean;
  };

  /** A workspace by its number from 1, the one above or below, or the one shown before. */
  export type WorkspaceTarget = number | "up" | "down" | "previous";
</script>

<script lang="ts">
  import type { BrowserWindow as Page } from "@domicile-desktop/sdk/desktop/browser";
  import { type PortalAnswer, PortalAnswerKind } from "@domicile-desktop/sdk/portal";
  import { PreviewedWindow } from "@domicile-desktop/sdk/previewed-window";
  import { type Entry, Menu } from "@domicile-svelte/menu";
  import { FileChooser } from "@domicile-svelte/portals";
  import { WindowRequestKind, WindowState } from "@domicile-desktop/sdk/window-state";
  import { fromListening, useDomicile, watch } from "@domicile-svelte/svelte";
  import { tick, untrack } from "svelte";
  import { MediaQuery, SvelteMap, SvelteSet } from "svelte/reactivity";

  import BrowserWindow from "./BrowserWindow.svelte";
  import {
    type Box,
    center as centered,
    type Columns,
    columnOf,
    consume as consumed,
    consumeOrExpel as consumedOrExpelled,
    type Direction,
    edge,
    expel as expelled,
    filled,
    moveColumn as columnMoved,
    moveWindow as windowMoved,
    neighbor,
    nextPreset,
    scrollTo,
    setFull,
    spans,
    successor,
    toggleFull,
  } from "./columns";
  import {
    boundsOf,
    clampPan,
    type Drop,
    dropAt,
    markOf,
    panTo,
    parkedRow,
    ROW_GAP,
    type Size,
    turned,
    zoomFor,
  } from "./overview";
  import { chooserOf } from "./page-files";
  import { confinedTo, confineFor, followPointerLock } from "./pointer";
  import { popupsOf } from "./popups";
  import Sleeper from "./Sleeper.svelte";
  import { argvOf, claimed, type Starting } from "./native";
  import { readSession, sessionWriter } from "./session-file";
  import { type Asleep, parseSession, renamed, restored, savedOf, sessionOf, sleeperOf } from "./session";
  import {
    droppedIn,
    emptyWorkspace,
    isEmpty,
    mapColumns,
    movedTo,
    placeAll,
    rowAt,
    rowsOf,
    synced,
    tidied,
    widest,
    windowsOf,
    workspaceOf,
    type Workspaces,
  } from "./workspaces";

  const {
    width = 1 / 2,
    presets = [1 / 3, 1 / 2, 2 / 3],
    gap = 8,
    settle = 220,
    letGoAfter = 5 * 60_000,
    warps = false,
  }: {
    /** Whether the pointer goes to a window focused from the keyboard, as niri's warp-mouse-to-focus. */
    warps?: boolean;
    /** How long a tile takes to ease into a new box, in milliseconds. */
    settle?: number;
    /** How long a page is out of view before the engine may unload it, in milliseconds. */
    letGoAfter?: number;
    /** A new column's width, as a proportion of the view's. */
    width?: number;
    /** The widths `cycleWidth` steps through, narrowest first. */
    presets?: readonly number[];
    gap?: number;
  } = $props();

  const { browser, capture, extensions, files, pointer, processes, session: lock, windows } = useDomicile();
  const list = watch(windows, "change", () => windows.list);
  const focused = watch(windows, "focuschange", () => windows.focused);
  const listed = watch(browser, "change", () => browser.windows);
  // An Electron app's hidden window is as good as closed until it is shown.
  const visible = $derived(listed.current?.filter((page) => !page.isHidden));
  const pages = {
    get current() {
      return visible;
    },
  };

  // A browser window's key; a native window's is its appId.
  const keyOf = (page: Page) => `browser:${page.id}`;
  const floats = (page: Page) => page.width > 0 || page.height > 0;

  // Menus and tooltips have a parent, and are drawn over it.
  const apps = $derived(list.current.filter((window) => window.parent === undefined));
  const tiledPages = $derived((pages.current ?? []).filter((page) => !floats(page)));

  let workspaces = $state.raw<Workspaces>([emptyWorkspace(1)]);
  // The workspaces as the last sync found them, with the windows it dropped:
  // where a closed window was, for the one that takes its place.
  let placedBefore: Workspaces = [];
  // The workspace shown, and the one before it, by id.
  let shown = $state(1);
  let shownBefore: number | undefined;
  const columns = $derived(workspaces.find(({ id }) => id === shown)?.columns ?? []);
  let viewWidth = $state(0);
  let viewHeight = $state(0);
  const scrolls = new SvelteMap<number, number>();
  const scroll = $derived(scrolls.get(shown) ?? 0);
  const sizes = $derived({ view: viewWidth, gap, height: viewHeight });
  const across = $derived(spans(columns, sizes));

  // The window that holds the keyboard, or held it last while shell UI (a
  // popup, a launcher) has it. Native focus reports itself; a browser window
  // is the shell's own page, so the shell tracks it here.
  let active = $state<string>();
  // bind:this sets a closed page's entry to null.
  const frames: Record<string, BrowserWindow | null> = {};
  // Oldest first. A closed window's key stays until it is shown or parked
  // again; `listing` leaves it out.
  let parked = $state<string[]>([]);
  // What each was sized when it was parked: shown again at that, its client
  // need not draw anew.
  const parkedSizes: Record<string, Size> = {};
  let overview = $state(false);
  // The part of the view's height that an empty workspace takes in the overview.
  const EMPTY = 0.2;
  const rows = $derived(
    rowsOf(workspaces, shown, {
      height: viewHeight,
      gap: overview ? ROW_GAP : gap,
      empty: overview ? viewHeight * EMPTY : viewHeight,
    }),
  );
  // As the strip's `scroll` leaves them. The overview draws every strip from
  // the same edge.
  const boxes = $derived(placeAll(workspaces, sizes, rows, (id) => (overview ? 0 : scroll - (scrolls.get(id) ?? 0))));
  const setWorkspaces = (next: Workspaces, show = shown) => {
    if (show !== shown) {
      shownBefore = shown;
      shown = show;
    }
    workspaces = tidied(next, show);
    if (!workspaces.some(({ id }) => id === shownBefore)) {
      shownBefore = undefined;
    }
  };
  // Fullscreen windows. One fills the screen while it is the active window,
  // and keeps its place on the strip.
  const fullscreen = new SvelteSet<string>();
  const covering = $derived(!overview && active !== undefined && fullscreen.has(active) ? active : undefined);
  // The last session's pages, until each is opened again.
  let asleep = $state.raw<Asleep[]>([]);
  // Asked to open, and not listed yet.
  const waking = new Map<string, ReturnType<typeof setTimeout>>();
  // Woken by the shell, so they take no keyboard they did not have.
  const quiet = new Set<string>();
  // The windows that held the keyboard, most recent first. A closed one goes;
  // a parked one stays, for when it is shown again.
  let history: string[] = [];
  let present: string[] = [];
  let seen: Set<string> | undefined;

  const WAKE_LIMIT_MS = 10_000;
  const wake = (key: string) => {
    const page = asleep.find((each) => each.key === key);
    if (page === undefined || waking.has(key)) {
      return;
    }
    // One that never opens may be asked for again.
    waking.set(
      key,
      setTimeout(() => waking.delete(key), WAKE_LIMIT_MS),
    );
    const { url, profile, isApp, appId } = page;
    if (isApp) {
      browser.openApp(url, { id: appId, profile });
    } else {
      browser.open(url, { profile });
    }
  };

  const doze = (key: string) => {
    clearTimeout(waking.get(key));
    waking.delete(key);
    asleep = asleep.filter((each) => each.key !== key);
  };

  // `page`'s window, if it is a sleeping page opened again, takes its place.
  const adopt = (page: Page) => {
    const saved = savedOf(page);
    const asked = asleep.filter(({ key }) => waking.has(key));
    // Any other window at a sleeping page's address is a new one, but an app
    // is the app.
    const apps = asleep.filter(({ isApp, appId }) => isApp && appId !== "");
    const sleeper = saved === undefined ? undefined : (sleeperOf(asked, saved) ?? sleeperOf(apps, saved));
    if (sleeper === undefined) {
      return;
    }
    const to = keyOf(page);
    const from = sleeper.key;
    const rename = (key: string) => (key === from ? to : key);
    if (waking.has(from) && active !== from) {
      quiet.add(to);
    }
    doze(from);
    workspaces = workspaces.map((each) => ({ ...each, columns: renamed(each.columns, from, to) }));
    parked = parked.map(rename);
    present = present.map(rename);
    history = history.map(rename);
    if (active === from) {
      active = to;
    }
  };

  // Each native window's command line, by process, to start it again after a
  // restart. Read once: a process's command line does not change.
  const processOf = (window: { pid?: number | undefined; pidfdInode?: number | undefined }) =>
    window.pid === undefined ? undefined : `${window.pid}:${window.pidfdInode ?? ""}`;
  const argvs = new SvelteMap<string, readonly string[]>();
  $effect(() => {
    for (const window of apps) {
      const process = processOf(window);
      if (process === undefined || argvs.has(process)) {
        continue;
      }
      argvs.set(process, []);
      void files.read(`/proc/${window.pid}/cmdline`).then((read) =>
        read.match({
          Ok: (bytes) => {
            argvs.set(process, argvOf(bytes));
          },
          Err: (error) => {
            console.error("[windows] command line of", window.appId, error);
          },
        }),
      );
    }
  });

  // The last session's native windows whose processes were started again,
  // each in its place until a window of its app opens, or for a while.
  let starting = $state.raw<Starting[]>([]);
  const START_LIMIT_MS = 30_000;
  const isStarting = (key: string) => starting.some((each) => each.key === key);
  const stopWaiting = (key: string) => {
    starting = starting.filter((each) => each.key !== key);
  };
  let claimedApps = new Set<string>();
  $effect(() => {
    const now = apps;
    untrack(() => {
      const fresh = now.filter((window) => !claimedApps.has(window.appId));
      claimedApps = new Set(now.map((window) => window.appId));
      for (const window of fresh) {
        const place = claimed(starting, window.desktopId);
        if (place === undefined) {
          continue;
        }
        const { key: from } = place;
        const to = window.appId;
        const rename = (key: string) => (key === from ? to : key);
        stopWaiting(from);
        workspaces = workspaces.map((each) => ({ ...each, columns: renamed(each.columns, from, to) }));
        parked = parked.map(rename);
        history = history.map(rename);
        if (active === from) {
          active = to;
        }
      }
    });
  });

  // A session that cannot be read is not written over.
  let kept = $state.raw<{ text: string | null }>();
  readSession(files, lock)
    .then((text) => (kept = { text }))
    .catch((error: unknown) => console.error("[windows] session", error));
  const write = sessionWriter(files, lock, (error) => console.error("[windows] session", error));
  let resumed = $state(false);
  $effect(() => {
    const current = pages.current;
    const text = kept?.text;
    if (current === undefined || text === undefined) {
      return;
    }
    untrack(() => {
      if (resumed) {
        for (const page of current) {
          if (!seen?.has(keyOf(page))) {
            adopt(page);
          }
        }
        return;
      }
      resumed = true;
      const session = parseSession(text);
      if (session === undefined) {
        return;
      }
      const open = current.flatMap((page) => {
        const saved = savedOf(page);
        return saved === undefined ? [] : [{ key: keyOf(page), page: saved }];
      });
      const last = restored(
        session,
        open,
        apps.map(({ appId, pid, pidfdInode }) => ({ key: appId, pid, pidfdInode })),
      );
      starting = last.starting;
      for (const argv of last.commands) {
        processes.launch(argv);
      }
      setTimeout(() => {
        starting = starting.filter((each) => !last.starting.includes(each));
      }, START_LIMIT_MS);
      const placed = new Set(last.workspaces.flat().flatMap((column) => column.windows));
      asleep = last.asleep;
      parked = [...last.parked, ...parked.filter((key) => !last.parked.includes(key))];
      const here = columns
        .map((column) => ({ ...column, windows: column.windows.filter((key) => !placed.has(key)) }))
        .filter((column) => column.windows.length > 0);
      const strips = last.workspaces.length === 0 ? [[]] : last.workspaces;
      const at = strips[last.at] === undefined ? 0 : last.at;
      const floating = workspaces.flatMap((each) => each.floating);
      const all = strips.map((strip, index) => ({
        ...emptyWorkspace(index + 1),
        columns: index === at ? [...strip, ...here] : strip,
        floating: index === at ? floating : [],
      }));
      setWorkspaces(all, workspaceOf(all, active) ?? at + 1);
      shownBefore = undefined;
      // An app notifies, so it runs whether or not it is looked at.
      for (const { key, isApp } of asleep) {
        if (isApp) {
          wake(key);
        }
      }
    });
  });

  // A page the focus rests on is opened, not one it passes over.
  const REST_MS = 300;
  $effect(() => {
    const key = active;
    if (key !== undefined && !overview && asleep.some((each) => each.key === key)) {
      const timer = setTimeout(() => wake(key), REST_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  });

  const SAVE_MS = 1000;
  const save = () => {
    const open = (pages.current ?? []).flatMap((page): Asleep[] => {
      const saved = savedOf(page);
      return saved === undefined ? [] : [{ ...saved, key: keyOf(page) }];
    });
    const native = apps.map((window) => {
      const process = processOf(window);
      return {
        key: window.appId,
        desktopId: window.desktopId,
        title: window.title,
        pid: window.pid,
        pidfdInode: window.pidfdInode,
        argv: (process === undefined ? undefined : argvs.get(process)) ?? [],
      };
    });
    const strips = {
      workspaces: workspaces.map((each) => each.columns),
      at: workspaces.findIndex(({ id }) => id === shown),
    };
    write(JSON.stringify(sessionOf([...open, ...asleep], native, strips, parked)));
  };
  $effect(() => {
    void [pages.current, asleep, workspaces, shown, parked, apps, argvs.size];
    if (!resumed) {
      return undefined;
    }
    const timer = setTimeout(save, SAVE_MS);
    return () => clearTimeout(timer);
  });

  // The effects below read the state they write untracked: tracked, each
  // write would rerun the effect that made it.
  $effect(() => {
    const now = focused.current;
    if (now !== undefined) {
      active = now;
      // A parked app that takes the keyboard (one asked to open again) comes
      // back.
      untrack(() => {
        // A window that takes the keyboard by itself, as one that opens.
        releasePage();
        overview = false;
        if (parked.includes(now)) {
          parked = parked.filter((key) => key !== now);
        }
      });
    }
  });

  $effect(() => {
    const out = (key: string) => !parked.includes(key);
    const open = {
      tiled: [
        ...apps.map((window) => window.appId),
        ...tiledPages.map(keyOf),
        ...asleep.map(({ key }) => key),
        ...starting.map(({ key }) => key),
      ].filter(out),
      floating: (pages.current ?? []).filter(floats).map(keyOf).filter(out),
    };
    const at = active;
    untrack(() => {
      placedBefore = workspaces;
      setWorkspaces(synced(workspaces, open, shown, at, width));
    });
  });

  // The active window's workspace is the one shown.
  $effect.pre(() => {
    const key = active;
    untrack(() => {
      const id = workspaceOf(workspaces, key);
      if (id !== undefined && id !== shown) {
        setWorkspaces(workspaces, id);
      }
    });
  });

  // The active column in view, and the view filled where the strip allows, so
  // a closed or narrowed column leaves no empty space behind. A pre effect, so
  // the scroll reaches the DOM in the same update as the boxes: a later update
  // would settle from a start that already holds the new boxes, and the strip
  // would jump. Not in the overview, which pans instead.
  $effect.pre(() => {
    const span = across[columnOf(columns, active)];
    const strip = across;
    const view = viewWidth;
    if (view > 0 && !overview) {
      untrack(() => {
        scrolls.set(shown, filled(span === undefined ? scroll : scrollTo(scroll, span, view), strip, view));
      });
    }
  });

  // The engine unloads a page only while no view shows it. One out of view for
  // this long is let go: it runs on, and is drawn again when it is in view.
  // The desktop an older engine hands a shell has no such call.
  const unloads = "discard" in browser;
  const letGo = new SvelteSet<string>();
  const inView = (key: string) => {
    const box = boxes.get(key);
    return (
      box !== undefined &&
      box.x < scroll + viewWidth &&
      box.x + box.width > scroll &&
      box.y < viewHeight &&
      box.y + box.height > 0
    );
  };
  const floatInView = (key: string) => workspaceOf(workspaces, key) === shown;
  const isDrawn = (page: Page, floating: boolean) => {
    const key = keyOf(page);
    if (page.isCaptured || (!overview && (inView(key) || (floating && floatInView(key))))) {
      return true;
    }
    // The overview shows every page that runs, and wakes none that does not.
    return page.isDiscarded !== true && (overview || !letGo.has(key));
  };
  const leaving = new Map<string, ReturnType<typeof setTimeout>>();
  $effect(() => {
    if (!unloads) {
      return;
    }
    const open = new Set<string>();
    for (const page of pages.current ?? []) {
      const key = keyOf(page);
      open.add(key);
      if (inView(key) || (floats(page) && floatInView(key))) {
        clearTimeout(leaving.get(key));
        leaving.delete(key);
        // After the focus that brought it into view, which looks here.
        void tick().then(() => letGo.delete(key));
      } else if (!leaving.has(key)) {
        leaving.set(
          key,
          setTimeout(() => letGo.add(key), letGoAfter),
        );
      }
    }
    for (const [key, timer] of leaving) {
      if (!open.has(key)) {
        clearTimeout(timer);
        leaving.delete(key);
        letGo.delete(key);
      }
    }
  });

  // The bar shows, and keys run, the extensions of the profile of the page last
  // focused. An Electron app's page is in none.
  const profile = $derived((pages.current ?? []).find((page) => keyOf(page) === active)?.profile);
  $effect(() => {
    if (profile !== undefined) {
      extensions.setProfile(profile);
    }
  });

  $effect(() => {
    const now = active;
    if (now !== undefined) {
      history = [now, ...history.filter((key) => key !== now)];
    }
  });

  /** The window of workspace `id` that held the keyboard last. */
  const lastIn = (id: number): string | undefined => {
    const here = workspaces.find((each) => each.id === id);
    const keys = here === undefined ? [] : windowsOf(here).filter((key) => exists(key) && !parked.includes(key));
    return history.find((key) => keys.includes(key)) ?? keys[0];
  };

  // The active window closed: the keyboard goes to the window that takes its
  // place (successor), so it stays where it was and the view need not move;
  // else, as for a floating window, to the window of its workspace that held
  // it before.
  $effect(() => {
    const now = [
      ...apps.map((window) => window.appId),
      ...(pages.current ?? []).map(keyOf),
      ...asleep.map(({ key }) => key),
      ...starting.map(({ key }) => key),
    ];
    untrack(() => {
      const closed = present.filter((key) => !now.includes(key));
      present = now;
      for (const key of closed) {
        fullscreen.delete(key);
      }
      if (closed.length === 0) {
        return;
      }
      history = history.filter((key) => now.includes(key));
      if (active === undefined || !closed.includes(active)) {
        return;
      }
      const closedAt = placedBefore.find(({ id }) => id === shown)?.columns ?? [];
      const taking = successor(closedAt, active);
      const next = taking !== undefined && now.includes(taking) ? taking : lastIn(shown);
      if (next === undefined) {
        active = undefined;
        windows.focusShell();
      } else {
        // A page's frame is gone with it only after the next render.
        void tick().then(() => focus(next));
      }
    });
  });

  // Rearranges the strip around the active window; it keeps the keyboard.
  // A window the change resizes is drawn as a still of itself first (see the
  // settle below), so the change waits for its stills; changes queue behind
  // each other in order.
  let rearranging = Promise.resolve();
  const rearrangeAll = (change: (workspaces: Workspaces) => Workspaces, also?: () => void) => {
    rearranging = rearranging
      .then(async () => {
        const before = placeAll(workspaces, sizes, rows, () => 0);
        const after = placeAll(change(workspaces), sizes, rows, () => 0);
        const resized = [...after].filter(([each, box]) => {
          const was = before.get(each);
          return was !== undefined && (was.width !== box.width || was.height !== box.height);
        });
        const taken = reducedMotion.current
          ? []
          : await Promise.all(resized.map(async ([each]) => [each, await stillOf(each)] as const));
        for (const [each, still] of taken) {
          if (still !== undefined) {
            stills.set(each, still);
          }
        }
        setWorkspaces(change(workspaces));
        // In the same update, so the tiles settle from where both left them.
        also?.();
      })
      .catch((error: unknown) => console.error("[windows] rearranging", error));
  };
  /** `change` on `key`'s strip. */
  const rearrange = (change: (columns: Columns, key: string) => Columns, key = active) => {
    if (key !== undefined) {
      rearrangeAll((now) => {
        const id = workspaceOf(now, key);
        return id === undefined ? now : mapColumns(now, id, (strip) => change(strip, key));
      });
    }
  };

  // While a page has the keyboard, keys never reach the shell's document, so
  // a native window cannot get them: the page must let go first.
  const releasePage = () => {
    const page = document.activeElement;
    if (page instanceof HTMLElement && page.closest(".browser") !== null) {
      page.blur();
    }
  };

  const exists = (key: string) =>
    apps.some((window) => window.appId === key) ||
    (pages.current ?? []).some((page) => keyOf(page) === key) ||
    asleep.some((each) => each.key === key) ||
    isStarting(key);

  const focus = (key: string) => {
    // The overview has the keyboard, and hands it to the window it closes on.
    if (overview) {
      active = key;
      return;
    }
    if (asleep.some((each) => each.key === key) || isStarting(key)) {
      active = key;
      releasePage();
      windows.focusShell();
      return;
    }
    const page = (pages.current ?? []).find((each) => keyOf(each) === key);
    if (page === undefined) {
      releasePage();
      windows.focus(key);
      return;
    }
    // A page that closed before its frame mounted, as a popup can, has none.
    const frame = frames[key];
    if (frame !== undefined && frame !== null) {
      const drawn = isDrawn(page, floats(page));
      active = key;
      windows.focusShell();
      if (!drawn) {
        // Its page is drawn on the next render.
        void tick().then(() => frame.focus());
      } else {
        frame.focus();
      }
    }
  };

  // A page that opens takes the keyboard, as a native window does
  // (focusNewWindows). Pages open when the list first arrives were there
  // before this shell, as after `domicile load-shell`, and are left alone.
  $effect(() => {
    const current = pages.current;
    if (current === undefined) {
      return;
    }
    const keys = current.map(keyOf);
    untrack(() => {
      const fresh = seen === undefined ? [] : keys.filter((key) => !seen?.has(key) && !quiet.delete(key));
      seen = new Set(keys);
      const last = fresh.at(-1);
      if (last !== undefined) {
        // Its frame mounts on the next render.
        void tick().then(() => focus(last));
      }
    });
  });

  /** Give the keyboard back to the window that last held it, or to the overview. */
  export const refocus = () => {
    if (overview) {
      windows.focusShell();
      layer?.focus();
    } else if (active !== undefined && exists(active)) {
      focus(active);
    }
  };

  /** Focus the neighbor of the active window in `direction`. */
  export const move = (direction: Direction) => {
    const next = neighbor(columns, active, direction);
    if (next !== undefined) {
      focus(next);
      void warp();
    }
  };

  /** Every workspace from the top, and whether it is the one shown. */
  export const listWorkspaces = (): { id: number; shown: boolean; empty: boolean }[] =>
    workspaces.map((each) => ({ id: each.id, shown: each.id === shown, empty: isEmpty(each) }));

  // A number past the last is the last.
  const idOf = (target: WorkspaceTarget): number | undefined => {
    const at = workspaces.findIndex(({ id }) => id === shown);
    const last = workspaces.length - 1;
    switch (target) {
      case "up":
        return workspaces[Math.max(0, at - 1)]?.id;
      case "down":
        return workspaces[Math.min(last, at + 1)]?.id;
      case "previous":
        return shownBefore;
      default:
        return workspaces[Math.max(0, Math.min(last, target - 1))]?.id;
    }
  };

  const showWorkspace = (id: number) => {
    if (id === shown) {
      return;
    }
    const key = lastIn(id);
    setWorkspaces(workspaces, id);
    active = key;
    if (key === undefined) {
      releasePage();
      windows.focusShell();
      refocus();
    } else {
      focus(key);
      void warp();
    }
  };

  /** Show a workspace, and focus its window that held the keyboard last. */
  export const focusWorkspace = (target: WorkspaceTarget) => {
    const id = idOf(target);
    if (id !== undefined) {
      showWorkspace(id);
    }
  };

  const takeTo = (target: WorkspaceTarget, what: "column" | "window") => {
    const key = active;
    const id = idOf(target);
    if (key === undefined || id === undefined || id === shown || workspaceOf(workspaces, key) !== shown) {
      return;
    }
    const after = lastIn(id);
    rearrangeAll(
      (now) => movedTo(now, key, id, what, after),
      () => {
        if (active === key && workspaceOf(workspaces, key) === id) {
          setWorkspaces(workspaces, id);
        }
      },
    );
  };

  /** Move the active window's column to a workspace, and show it there. */
  export const moveToWorkspace = (target: WorkspaceTarget) => takeTo(target, "column");

  /** Move the active window up or down in its column, or from its end to the next workspace. */
  export const moveWindowOrToWorkspace = (direction: "up" | "down") => {
    if (neighbor(columns, active, direction) === undefined || columnOf(columns, active) === -1) {
      takeTo(direction, "window");
    } else {
      moveWindow(direction);
    }
  };

  /** Ask the active window to close. */
  export const close = () => {
    const page = (pages.current ?? []).find((each) => keyOf(each) === active);
    if (page !== undefined) {
      browser.close(page.id);
    } else if (active !== undefined && asleep.some(({ key }) => key === active)) {
      doze(active);
    } else if (active !== undefined && isStarting(active)) {
      stopWaiting(active);
    } else if (active !== undefined && exists(active)) {
      windows.close(active);
    }
  };

  /** Focus the first or last column, in the active window's row. */
  export const moveToEdge = (end: "first" | "last") => {
    const next = edge(columns, active, end);
    if (next !== undefined) {
      focus(next);
      void warp();
    }
  };

  /** niri's consume-or-expel-window-left and -right on the active window. */
  export const consumeOrExpel = (side: "left" | "right") =>
    rearrange((now, key) => consumedOrExpelled(now, key, side, width));

  /** The next column's top window joins the active window's column. */
  export const consume = () => rearrange(consumed);

  /** The active window leaves its column for a column of its own on the right. */
  export const expel = () => rearrange((now, key) => expelled(now, key, width));

  /** Move the active window's column one place, or to an end of the strip. */
  export const moveColumn = (to: "left" | "right" | "first" | "last") =>
    rearrange((now, key) => columnMoved(now, key, to));

  /** Move the active window up or down in its column. */
  export const moveWindow = (direction: "up" | "down") => rearrange((now, key) => windowMoved(now, key, direction));

  /** Maximize the active window's column, or give it back its width. */
  export const maximize = () => rearrange(toggleFull);

  const setFullscreen = (key: string, on: boolean) => {
    if (on) {
      fullscreen.add(key);
    } else {
      fullscreen.delete(key);
    }
  };

  /** Fill the screen with the active window, or put it back on the strip. */
  export const toggleFullscreen = () => {
    if (active !== undefined && exists(active)) {
      setFullscreen(active, !fullscreen.has(active));
    }
  };

  /** Step the active window's column through `presets`. */
  export const cycleWidth = () => rearrange((now, key) => nextPreset(now, key, presets));

  /** Scroll the active window's column to the middle of the view. */
  export const center = () => {
    const span = across[columnOf(columns, active)];
    if (span !== undefined) {
      scrolls.set(shown, centered(span, viewWidth));
    }
  };

  /** Take the active window off the strip, and focus its neighbor. */
  export const park = () => {
    const key = active;
    if (key === undefined || !exists(key)) {
      return;
    }
    const next = (["left", "right", "up", "down"] as const)
      .map((direction) => neighbor(columns, key, direction))
      .find((found) => found !== undefined && found !== key);
    const box = boxes.get(key);
    if (box !== undefined) {
      parkedSizes[key] = { width: box.width, height: box.height };
    }
    parked = [...parked.filter((each) => each !== key), key];
    if (next === undefined) {
      active = undefined;
      releasePage();
      windows.focusShell();
    } else {
      focus(next);
    }
  };

  const minimize = (key: string) => {
    if (key === active) {
      park();
    } else if (!parked.includes(key)) {
      parked = [...parked, key];
    }
  };

  // What native windows ask to be. None of it happens until the states say so.
  $effect(() =>
    fromListening(
      () => windows.requests(),
      "what windows ask",
    )((request) => {
      const { appId } = request;
      switch (request.kind) {
        case WindowRequestKind.Fullscreen:
        case WindowRequestKind.Unfullscreen:
          return setFullscreen(appId, request.kind === WindowRequestKind.Fullscreen);
        case WindowRequestKind.Maximize:
        case WindowRequestKind.Unmaximize:
          return rearrange((now) => setFull(now, appId, request.kind === WindowRequestKind.Maximize), appId);
        case WindowRequestKind.Minimize:
          return minimize(appId);
        default:
          return undefined;
      }
    }),
  );

  const isMaximized = (key: string) =>
    workspaces.some((each) => each.columns[columnOf(each.columns, key)]?.full === true);

  const TILED = [WindowState.TiledLeft, WindowState.TiledRight, WindowState.TiledTop, WindowState.TiledBottom];
  const told = new Map<string, string>();
  $effect(() => {
    for (const { appId } of apps) {
      const states = [
        ...TILED,
        ...(isMaximized(appId) ? [WindowState.Maximized] : []),
        ...(fullscreen.has(appId) ? [WindowState.Fullscreen] : []),
      ];
      const said = states.join();
      if (told.get(appId) !== said) {
        told.set(appId, said);
        windows
          .setStates(appId, states)
          .then((set) =>
            set.match({ Ok: () => undefined, Err: (error) => console.error("[windows] states of", appId, error) }),
          )
          .catch((error: unknown) => console.error("[windows] states of", appId, error));
      }
    }
    for (const appId of told.keys()) {
      if (!apps.some((window) => window.appId === appId)) {
        told.delete(appId);
      }
    }
  });

  // What an Electron app asks its window to be, acted on as it changes.
  type Wants = { fullscreen: boolean; maximized: boolean; minimized: boolean };
  const wishes = new Map<string, Wants>();
  $effect(() => {
    for (const page of pages.current ?? []) {
      const key = keyOf(page);
      const was = wishes.get(key) ?? { fullscreen: false, maximized: false, minimized: false };
      const now = { fullscreen: page.wantsFullscreen, maximized: page.wantsMaximized, minimized: page.wantsMinimized };
      wishes.set(key, now);
      untrack(() => {
        if (now.fullscreen !== was.fullscreen) {
          setFullscreen(key, now.fullscreen);
        }
        if (now.maximized !== was.maximized) {
          rearrange((each) => setFull(each, key, now.maximized), key);
        }
        if (now.minimized && !was.minimized) {
          minimize(key);
        } else if (was.minimized && !now.minimized && parked.includes(key)) {
          void show(key);
        }
      });
    }
  });
  $effect(() => {
    for (const page of pages.current ?? []) {
      const key = keyOf(page);
      browser.setWindowState(page.id, {
        fullscreen: fullscreen.has(key),
        maximized: isMaximized(key),
        minimized: parked.includes(key),
      });
    }
  });

  // Longer than the engine takes to hear that no view shows a page.
  const HIDDEN_MS = 1000;

  /** Park the active window, and free its page's memory until it is shown. */
  export const unload = () => {
    const page = (pages.current ?? []).find((each) => keyOf(each) === active);
    if (page === undefined || !unloads) {
      return;
    }
    const key = keyOf(page);
    park();
    letGo.add(key);
    setTimeout(() => {
      if (parked.includes(key)) {
        browser.discard(page.id);
      }
    }, HIDDEN_MS);
  };

  const bring = async (key: string) => {
    overview = false;
    if (parked.includes(key)) {
      parked = parked.filter((each) => each !== key);
      // Placed beside the active window once the columns follow.
      await tick();
    }
    focus(key);
  };

  /** Bring `key` back, parked or not, and give it the keyboard. */
  export const show = async (key: string) => {
    await bring(key);
    await warp();
  };

  /** Every open window, the strip's first and then the parked. */
  export const listing = (): Listed[] => {
    const native = apps.map((window) => ({ key: window.appId, title: window.title, app: window.desktopId }));
    const browsers = (pages.current ?? []).map((page) => ({
      key: keyOf(page),
      title: page.title || page.url,
      // An app window's id is its desktop entry's, as croshome writes them.
      app: page.isApp && page.appId !== "" ? page.appId : "browser",
    }));
    const sleeping = asleep.map(({ key, title, url, isApp, appId }) => ({
      key,
      title: title || url,
      app: isApp && appId !== "" ? appId : "browser",
    }));
    const order = workspaces.flatMap(windowsOf);
    return [...native, ...browsers, ...sleeping]
      .map((window) => ({ ...window, parked: parked.includes(window.key) }))
      .sort((a, b) => Number(a.parked) - Number(b.parked) || order.indexOf(a.key) - order.indexOf(b.key));
  };

  // Tiles settle as manganese's windows do (useSettling in domicile): a tile
  // takes its new box at once, so its client is asked for the new size at
  // once, and the engine holds the page's frame until the client draws at it.
  // The tile is then drawn where it was, with `transform`, and eased into the
  // new box. Only the transform animates, never the layout, so the client is
  // configured once per change.
  //
  // Where it was is where it was drawn, read before the DOM updates: mid-way
  // through a settle when a new one interrupts it, so nothing jumps.
  //
  // A resized window crossfades as niri's do: a still of it at its old size
  // covers it, scaled with the tile, and fades out as the tile settles. The
  // scale stretches the client's new drawing up to twice over; under the
  // still, it shows only as the scale nears 1.
  const reducedMotion = new MediaQuery("prefers-reduced-motion: reduce");
  const SETTLE_CURVE = "cubic-bezier(0.2, 0, 0, 1)";
  // A still slower than this is not worth holding the change for.
  const STILL_WAIT_MS = 150;
  const tiles: Record<string, HTMLElement | null> = {};
  const stillImages: Record<string, HTMLImageElement | null> = {};
  const stills = new SvelteMap<string, string>();
  let drawnBefore = new Map<string, DOMRect>();
  let measured = $state(0);

  // Decoded before it is shown, so its first frame has it.
  const stillOf = async (key: string): Promise<string | undefined> => {
    if (asleep.some((each) => each.key === key) || isStarting(key)) {
      return undefined;
    }
    const page = (pages.current ?? []).find((each) => keyOf(each) === key);
    const taking = capture
      .preview(page === undefined ? PreviewedWindow.App(key) : PreviewedWindow.Browser(page.id))
      .then((taken) =>
        taken.match({
          Ok: async (still) => {
            const image = new Image();
            image.src = still;
            await image.decode();
            return still;
          },
          Err: (error) => {
            console.error("[windows] no still of", key, error);
            return undefined;
          },
        }),
      );
    const late = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), STILL_WAIT_MS));
    return Promise.race([taking, late]);
  };

  const fadeStill = (key: string) => {
    const still = stills.get(key);
    const image = stillImages[key];
    if (still === undefined || image === undefined || image === null || image.getAnimations().length > 0) {
      return;
    }
    const fading = image.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: settle,
      easing: SETTLE_CURVE,
      fill: "forwards",
    });
    fading.onfinish = () => {
      if (stills.get(key) === still) {
        stills.delete(key);
      }
    };
  };

  const floatBox = (page: Page) => {
    const w = Math.min(page.width || 480, viewWidth);
    const h = Math.min(page.height || 640, viewHeight);
    const y = rows.get(workspaceOf(workspaces, keyOf(page)) ?? shown)?.y ?? 0;
    return { x: (viewWidth - w) / 2, y: y + (viewHeight - h) / 2, width: w, height: h };
  };

  let strip = $state<HTMLElement>();
  // Where the last workspace ends.
  const bottom = $derived(Math.max(viewHeight, ...[...rows.values()].map((row) => row.y + row.height)));
  const parkedBoxes = $derived.by(() => {
    if (!overview) {
      return new Map<string, Box>();
    }
    const parkedAt = parked.flatMap((key): [string, Size][] => {
      const page = (pages.current ?? []).find((each) => keyOf(each) === key);
      if (page === undefined && !exists(key)) {
        return [];
      }
      const fallback = page !== undefined && floats(page) ? floatBox(page) : undefined;
      return [[key, parkedSizes[key] ?? fallback ?? { width: (viewWidth - gap) * width, height: viewHeight }]];
    });
    return parkedRow(new Map(parkedAt), { strip: widest(workspaces, sizes), height: bottom, gap });
  });

  // Before the DOM takes the new boxes. Parked windows too: the first run is
  // at once, so all it reads is declared above.
  $effect.pre(() => {
    void boxes;
    void scroll;
    void parkedBoxes;
    void covering;
    untrack(() => {
      drawnBefore = new Map();
      for (const [key, tile] of Object.entries(tiles)) {
        if (tile !== null) {
          drawnBefore.set(key, tile.getBoundingClientRect());
        }
      }
      measured += 1;
    });
  });

  // Once per measurement, not on what the measurement reads: an effect before
  // this one in the same flush writes `columns`, and this would then run before
  // they are measured, and ease from where the last move began.
  $effect(() => {
    void measured;
    untrack(() => {
      if (reducedMotion.current) {
        return;
      }
      // Rects are on the screen; a tile moves in the strip's own pixels, which
      // the overview draws smaller.
      const drawn = strip === undefined || viewWidth === 0 ? 1 : strip.getBoundingClientRect().width / viewWidth;
      for (const [key, tile] of Object.entries(tiles)) {
        const before = drawnBefore.get(key);
        if (tile === null || before === undefined || before.width === 0 || before.height === 0) {
          stills.delete(key);
          continue;
        }
        fadeStill(key);
        for (const running of tile.getAnimations()) {
          running.cancel();
        }
        const after = tile.getBoundingClientRect();
        if (after.width === 0 || after.height === 0) {
          continue;
        }
        const x = (before.left - after.left) / drawn;
        const y = (before.top - after.top) / drawn;
        const scaleX = before.width / after.width;
        const scaleY = before.height / after.height;
        if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5 && Math.abs(scaleX - 1) < 0.001 && Math.abs(scaleY - 1) < 0.001) {
          continue;
        }
        tile.animate([{ transform: `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})` }, { transform: "none" }], {
          duration: settle,
          easing: SETTLE_CURVE,
        });
      }
    });
  });

  // Where a window is once it settles, in the page.
  let viewElement = $state<HTMLElement>();
  const boxOf = (key: string): Box | undefined => {
    if (key === covering) {
      return { x: 0, y: 0, width: innerWidth, height: innerHeight };
    }
    const corner = viewElement?.getBoundingClientRect();
    const page = (pages.current ?? []).find((each) => keyOf(each) === key);
    const floating = page !== undefined && floats(page) && !parked.includes(key);
    const box = floating ? floatBox(page) : boxes.get(key);
    return corner === undefined || box === undefined
      ? undefined
      : { ...box, x: corner.x + box.x - (floating ? 0 : scroll), y: corner.y + box.y };
  };

  $effect(() => followPointerLock(windows));

  // Held once the engine holds it, and let go when the window that asked loses
  // the keyboard.
  const confined = $derived(confineFor(list.current, focused.current));
  const confinedKey = $derived(confined?.appId);
  const confinement = $derived.by(() => {
    const box = confined === undefined || overview ? undefined : boxOf(confined.appId);
    return confined === undefined || box === undefined ? "[]" : JSON.stringify(confinedTo(confined, box));
  });
  const isConfined = $derived(confinement !== "[]");
  $effect(() => {
    const key = confinedKey;
    if (key === undefined || !isConfined) {
      return undefined;
    }
    let held = true;
    let said = false;
    const stop = $effect.root(() => {
      $effect(() => {
        pointer
          .confine(JSON.parse(confinement) as Box[])
          .then(() => {
            if (held && !said) {
              said = true;
              windows.pointerConstrained(key, true);
            }
          })
          .catch((error: unknown) => console.error("[windows] confining the pointer", error));
      });
    });
    return () => {
      held = false;
      stop();
      pointer.confine([]).catch((error: unknown) => console.error("[windows] letting the pointer go", error));
      if (said) {
        windows.pointerConstrained(key, false);
      }
    };
  });

  // To the middle of the window, unless the pointer is over it.
  const warp = async () => {
    if (!warps) {
      return;
    }
    await tick();
    const box = active === undefined || overview ? undefined : boxOf(active);
    if (box !== undefined) {
      pointer.warp(box.x + box.width / 2, box.y + box.height / 2, box);
    }
  };

  // A page's context menu. Drawn out of its tile, whose transform and clip
  // would place it.
  let menu = $state.raw<{ entries: Entry[]; x: number; y: number; onclose?: (() => void) | undefined }>();
  const closeMenu = (which: typeof menu) => {
    if (menu === which) {
      menu = undefined;
      refocus();
    }
    which?.onclose?.();
  };
  const openMenu = (entries: Entry[], x: number, y: number, onclose?: () => void) => {
    const replaced = menu;
    const next = { entries, x, y, onclose };
    menu = next;
    replaced?.onclose?.();
    return () => closeMenu(next);
  };

  // What pages ask for files, one shown at a time, oldest first.
  let choosing = $state.raw<readonly DomicileFileChooserEvent[]>([]);
  const answerFiles = (request: DomicileFileChooserEvent) => (answer: PortalAnswer) => {
    choosing = choosing.filter((each) => each !== request);
    try {
      if (answer.kind === PortalAnswerKind.FileChooser) {
        request.choose(answer.chosen.paths);
      } else {
        request.cancel();
      }
    } catch (error) {
      // Its page went meanwhile, or it takes no such paths.
      console.error("[windows] files", error);
    }
    if (choosing.length === 0) {
      refocus();
    }
  };

  // The overview: the strip's box, drawn smaller by a transform. The windows
  // keep their layout, so no client draws anew, and stay live. A layer over
  // them takes the pointer and the keyboard.
  let layer = $state<HTMLElement | null>();
  const view = $derived({ width: viewWidth, height: viewHeight });
  const bounds = $derived(
    boundsOf([
      ...[...rows.values()].map((row) => ({ x: 0, width: 0, ...row })),
      ...boxes.values(),
      ...parkedBoxes.values(),
    ]),
  );
  const zoom = $derived(zoomFor(bounds, view));
  let wanted = $state(0);
  const pan = $derived(clampPan(wanted, bounds, view, zoom));
  let wantedDown = $state(0);
  const panDown = $derived(clampPan(wantedDown, turned(bounds), turned(view), zoom));
  const top = $derived(viewHeight / 2 - zoom * panDown);
  const camera = $derived(
    overview ? `translate(${viewWidth / 2 - zoom * (pan - scroll)}px, ${top}px) scale(${zoom})` : "none",
  );

  // The active window in the overview's view.
  $effect.pre(() => {
    const box = active === undefined ? undefined : (boxes.get(active) ?? parkedBoxes.get(active));
    if (overview && box !== undefined) {
      untrack(() => {
        wanted = panTo(pan, box, view, zoom);
        wantedDown = panTo(panDown, turned(box), turned(view), zoom);
      });
    }
  });

  $effect(() => {
    if (layer !== undefined && layer !== null) {
      untrack(refocus);
    }
  });

  /** Open the overview, or close it on the active window. */
  export const toggleOverview = () => {
    if (overview) {
      overview = false;
      refocus();
    } else {
      wanted = scroll + viewWidth / 2;
      wantedDown = viewHeight / 2;
      releasePage();
      overview = true;
    }
  };

  /** Open or close the overview. */
  export const setOverview = (open: boolean) => {
    if (open !== overview) {
      toggleOverview();
    }
  };

  let drag = $state<{ key: string; from: { x: number; y: number }; by: { x: number; y: number } }>();
  // Into a workspace, by its id, when it is empty.
  let dropping = $state<Drop | "park" | number>();
  let pressed: { key: string | undefined; from: { x: number; y: number } } | undefined;
  const DRAG_AFTER = 8;

  const pointIn = ({ clientX, clientY }: MouseEvent) => {
    const corner = layer?.getBoundingClientRect();
    return {
      x: (clientX - (corner?.left ?? 0) - viewWidth / 2) / zoom + pan,
      y: (clientY - (corner?.top ?? 0) - top) / zoom,
    };
  };

  // Floating windows are over the others.
  const keyAt = ({ clientX: x, clientY: y }: MouseEvent) =>
    Object.entries(tiles)
      .filter(([, tile]) => {
        const rect = tile?.getBoundingClientRect();
        return rect !== undefined && x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
      })
      .map(([key]) => key)
      .sort((one, other) => Number(boxes.has(one)) - Number(boxes.has(other)))[0];

  const press = (event: PointerEvent & { currentTarget: HTMLElement }) => {
    if (event.button === 0) {
      event.currentTarget.setPointerCapture(event.pointerId);
      pressed = { key: keyAt(event), from: pointIn(event) };
    }
  };

  const dragOver = (event: PointerEvent) => {
    const key = pressed?.key;
    if (pressed === undefined || key === undefined || !(boxes.has(key) || parkedBoxes.has(key))) {
      return;
    }
    const at = pointIn(event);
    const by = { x: at.x - pressed.from.x, y: at.y - pressed.from.y };
    if (drag !== undefined || Math.hypot(by.x, by.y) * zoom >= DRAG_AFTER) {
      drag = { key, from: pressed.from, by };
      const into = workspaces.find(({ id }) => id === rowAt(rows, at.y));
      dropping =
        at.y > bottom + ROW_GAP / 2
          ? "park"
          : into?.columns.length === 0
            ? into.id
            : dropAt(into?.columns ?? [], boxes, key, at);
    }
  };

  const unpark = async (key: string) => {
    parked = parked.filter((each) => each !== key);
    // Beside the active window once the columns follow.
    await tick();
  };

  const drop = async (key: string, where: Drop | "park" | number | undefined) => {
    const letGo = () => {
      drag = undefined;
      dropping = undefined;
    };
    if (where === undefined || (where === "park" && parked.includes(key))) {
      letGo();
    } else if (where === "park") {
      active = key;
      park();
      letGo();
    } else {
      if (parked.includes(key)) {
        await unpark(key);
      }
      active = key;
      // A floating window goes back to its own place.
      if (!workspaces.some((each) => columnOf(each.columns, key) !== -1)) {
        letGo();
      } else {
        rearrangeAll(
          (now) => droppedIn(now, key, where, width),
          () => {
            setWorkspaces(workspaces, workspaceOf(workspaces, key));
            letGo();
          },
        );
      }
    }
  };

  const release = (event: PointerEvent) => {
    const { key } = pressed ?? {};
    pressed = undefined;
    if (drag !== undefined) {
      void drop(drag.key, dropping);
    } else if (key === undefined) {
      const { y } = pointIn(event);
      const id = rowAt(rows, y);
      if (id !== undefined && y < bottom) {
        showWorkspace(id);
      }
      toggleOverview();
    } else {
      void bring(key);
    }
  };

  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    // Up and down only where it reaches further than the view.
    const tall = bounds.height * zoom > viewHeight;
    wanted = clampPan(pan + (event.deltaX || (tall ? 0 : event.deltaY)) / zoom, bounds, view, zoom);
    if (tall) {
      wantedDown = clampPan(panDown + event.deltaY / zoom, turned(bounds), turned(view), zoom);
    }
  };

  const ARROWS: Record<string, Direction> = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
  };
  const keydown = (event: KeyboardEvent) => {
    const direction = ARROWS[event.key];
    if (event.key === "Escape" || event.key === "Enter") {
      toggleOverview();
    } else if (direction !== undefined) {
      if ((direction === "up" || direction === "down") && neighbor(columns, active, direction) === undefined) {
        focusWorkspace(direction);
      } else {
        move(direction);
      }
    } else {
      return;
    }
    event.preventDefault();
  };

  // Closed some other way, such as by a window that took the keyboard.
  $effect(() => {
    if (!overview) {
      drag = undefined;
      dropping = undefined;
      pressed = undefined;
    }
  });

  const mark = $derived(
    dropping === "park"
      ? { x: 0, y: bottom + ROW_GAP / 2, width: Math.max(viewWidth, bounds.width), height: gap }
      : dropping === undefined
        ? undefined
        : typeof dropping === "number"
          ? { x: 0, width: gap, ...(rows.get(dropping) ?? { y: 0, height: 0 }) }
          : markOf(
              workspaces.flatMap((each) => each.columns),
              boxes,
              dropping,
              gap,
            ),
  );

  const translateOf = (key: string, box: Box | undefined, fixed = false) => {
    const by = drag?.key === key ? drag.by : { x: 0, y: 0 };
    return `${(box?.x ?? 0) - (fixed ? 0 : scroll) + by.x}px ${(box?.y ?? 0) + by.y}px`;
  };
</script>

{#snippet still(key: string)}
  {@const url = stills.get(key)}
  {#if url !== undefined}
    <img class="still" src={url} alt="" bind:this={stillImages[key]} />
  {/if}
{/snippet}

<div class="view" bind:this={viewElement} bind:clientWidth={viewWidth} bind:clientHeight={viewHeight}>
  <!-- Two append-only lists, so no element ever moves in the document: a
       moved <webview> reconnects, and its page shows in one view at a time. -->
  <div
    class="strip"
    bind:this={strip}
    style:transform={camera}
    style:transition={reducedMotion.current ? "none" : `transform ${settle}ms ${SETTLE_CURVE}`}
    style:--zoom={overview ? zoom : 1}
  >
    {#each apps as window (window.appId)}
      {@const box = boxes.get(window.appId) ?? parkedBoxes.get(window.appId)}
      {@const popups = popupsOf(list.current, window.appId)}
      <div
        class="tile native"
        class:hidden={box === undefined}
        class:covering={window.appId === covering}
        class:menu={popups.some((popup) => popup.window.grab)}
        class:active={window.appId === active}
        class:dragged={window.appId === drag?.key}
        bind:this={tiles[window.appId]}
        style:translate={translateOf(window.appId, box)}
        style:width="{box?.width ?? 0}px"
        style:height="{box?.height ?? 0}px"
      >
        <div class="contents">
          <app app-id={window.appId} style:cursor={window.cursorImage ?? window.cursor}></app>
          {@render still(window.appId)}
        </div>
        {#each popups as popup (popup.window.appId)}
          <app
            class="popup"
            app-id={popup.window.appId}
            style:left="{popup.x}px"
            style:top="{popup.y}px"
            style:width="{popup.window.width}px"
            style:height="{popup.window.height}px"
            style:cursor={popup.window.cursorImage ?? popup.window.cursor}
          ></app>
        {/each}
      </div>
    {/each}
    {#each pages.current ?? [] as page (page.id)}
      {@const key = keyOf(page)}
      {@const floating = floats(page)}
      {@const isParked = parked.includes(key)}
      {@const box = isParked ? parkedBoxes.get(key) : floating ? floatBox(page) : boxes.get(key)}
      {@const drawn = isDrawn(page, floating)}
      <div
        class="tile"
        class:floating
        class:covering={key === covering}
        class:hidden={box === undefined}
        class:active={key === active}
        class:dragged={key === drag?.key}
        bind:this={tiles[key]}
        style:translate={translateOf(key, box, floating && !isParked)}
        style:width="{box?.width ?? 0}px"
        style:height="{box?.height ?? 0}px"
      >
        <BrowserWindow
          bind:this={frames[key]}
          window={page}
          {drawn}
          active={key === active}
          fullscreen={fullscreen.has(key)}
          onfullscreen={(on) => setFullscreen(key, on)}
          onfocus={() => {
            active = key;
            windows.focusShell();
          }}
          onfocusrequest={() => focus(key)}
          onmenu={openMenu}
          onfiles={(request) => (choosing = [...choosing, request])}
          onunload={unloads
            ? () => {
                active = key;
                unload();
              }
            : undefined}
        />
        {#if page.isDiscarded && !drawn}
          <div class="asleep"><Sleeper {page} onwake={() => focus(key)} /></div>
        {/if}
        {@render still(key)}
      </div>
    {/each}
    {#each asleep as page (page.key)}
      {@const box = boxes.get(page.key) ?? parkedBoxes.get(page.key)}
      <div
        class="tile"
        class:hidden={box === undefined}
        class:active={page.key === active}
        class:dragged={page.key === drag?.key}
        bind:this={tiles[page.key]}
        style:translate={translateOf(page.key, box)}
        style:width="{box?.width ?? 0}px"
        style:height="{box?.height ?? 0}px"
      >
        <Sleeper {page} onwake={() => focus(page.key)} />
      </div>
    {/each}
    {#each starting as window (window.key)}
      {@const box = boxes.get(window.key) ?? parkedBoxes.get(window.key)}
      <div
        class="tile"
        class:hidden={box === undefined}
        class:active={window.key === active}
        bind:this={tiles[window.key]}
        style:translate={translateOf(window.key, box)}
        style:width="{box?.width ?? 0}px"
        style:height="{box?.height ?? 0}px"
      >
        <Sleeper page={{ url: window.desktopId, title: window.title }} onwake={() => focus(window.key)} />
      </div>
    {/each}
    {#if overview}
      {#each workspaces.filter(isEmpty) as { id } (id)}
        {@const row = rows.get(id)}
        <div
          class="empty"
          class:shown={id === shown}
          style:translate="{-scroll}px {row?.y ?? 0}px"
          style:transition={reducedMotion.current ? "none" : `translate ${settle}ms ${SETTLE_CURVE}`}
          style:width="{viewWidth}px"
          style:height="{row?.height ?? 0}px"
        ></div>
      {/each}
    {/if}
    {#if overview && mark !== undefined}
      <div
        class="mark"
        style:translate="{mark.x - scroll}px {mark.y}px"
        style:width="{mark.width}px"
        style:height="{mark.height}px"
      ></div>
    {/if}
  </div>
  {#if overview}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="layer"
      role="dialog"
      aria-label="Overview"
      tabindex="-1"
      bind:this={layer}
      onpointerdown={press}
      onpointermove={dragOver}
      onpointerup={release}
      onpointercancel={() => {
        pressed = undefined;
        drag = undefined;
        dropping = undefined;
      }}
      onwheel={wheel}
      onkeydown={keydown}
    ></div>
  {/if}
</div>

{#if choosing[0] !== undefined}
  {@const request = choosing[0]}
  {#key request}
    <FileChooser body={chooserOf(request)} answer={answerFiles(request)} />
  {/key}
{/if}

{#if menu !== undefined}
  {#key menu}
    <Menu entries={menu.entries} x={menu.x} y={menu.y} label="Page" onclose={() => closeMenu(menu)} />
  {/key}
{/if}

<style>
  .view {
    position: relative;
    flex: 1;
    min-height: 0;
    margin: 8px 0;
    overflow: hidden;
  }

  .strip {
    position: absolute;
    inset: 0;
    transform-origin: 0 0;
  }

  .layer {
    position: absolute;
    inset: 0;
    z-index: 1;
    outline: none;
  }

  .empty {
    position: absolute;
    top: 0;
    left: 0;
    border: calc(1px / var(--zoom, 1)) solid #45475a;
    border-radius: 8px;
    box-sizing: border-box;
  }

  .empty.shown {
    border: calc(2px / var(--zoom, 1)) solid #74c7ec;
  }

  .mark {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 2;
    border-radius: 4px;
    background: #a6e3a1;
  }

  .dragged {
    z-index: 3;
    opacity: 0.8;
  }

  .tile {
    position: absolute;
    top: 0;
    left: 0;
    border-radius: 8px;
    overflow: hidden;
    /* The settle's transform scales and moves from the tile's corner. */
    transform-origin: 0 0;
  }

  /* Only its contents are clipped: a menu may reach past its window. */
  .native {
    overflow: visible;
  }

  .contents {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    overflow: hidden;
  }

  .popup {
    position: absolute;
    z-index: 2;
  }

  /* Over its neighbors, and over floating windows. */
  .menu {
    z-index: 2;
  }

  /* Not placed yet. A page under display: none stays mounted, as a
     background tab. */
  .hidden {
    display: none;
  }

  .floating {
    z-index: 1;
    box-shadow: 0 8px 32px #000a;
  }

  /* Over the bar, under what opens over windows. */
  .tile.covering {
    position: fixed;
    inset: 0;
    z-index: 5;
    width: 100vw !important;
    height: 100vh !important;
    translate: none !important;
    border-radius: 0;
  }

  .covering::after {
    display: none;
  }

  .asleep {
    position: absolute;
    inset: 0;
  }

  /* Over the window: a native window is a layer that would cover an inset
     outline, and the view clips one drawn outside. */
  .active::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    border: calc(2px / var(--zoom, 1)) solid #74c7ec;
    border-radius: inherit;
    pointer-events: none;
  }

  app {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* Stretched to the tile's new box; the settle's scale takes it back to its
     own size. Under the active outline, which comes after it. */
  .still {
    position: absolute;
    inset: 0;
    z-index: 1;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
