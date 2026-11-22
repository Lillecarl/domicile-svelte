<!--
  Windows in columns on a strip that scrolls to keep the focused column in
  view, as niri lays them out. Native windows and browser windows tile
  alike; a browser window that asked for a size (an extension's popup window,
  a page's sized window.open) floats over the strip at that size.

  A parked window keeps running off the strip, as a background tab does, until
  `show` brings it back beside the active window.

  Bind keys to `move`, `close`, `park`, `refocus` and niri's column actions
  (`consumeOrExpel`, `maximize`, `cycleWidth` and the rest); `listing` and
  `show` serve a window switcher.
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
</script>

<script lang="ts">
  import type { BrowserWindow as Page } from "@domicile-desktop/sdk/desktop/browser";
  import { PreviewedWindow } from "@domicile-desktop/sdk/previewed-window";
  import { useDomicile, watch } from "@domicile-svelte/svelte";
  import { tick, untrack } from "svelte";
  import { MediaQuery, SvelteMap } from "svelte/reactivity";

  import BrowserWindow from "./BrowserWindow.svelte";
  import {
    center as centered,
    type Columns,
    columnOf,
    consume as consumed,
    consumeOrExpel as consumedOrExpelled,
    type Direction,
    edge,
    expel as expelled,
    moveColumn as columnMoved,
    moveWindow as windowMoved,
    neighbor,
    nextPreset,
    place,
    scrollTo,
    spans,
    sync,
    toggleFull,
  } from "./columns";

  const {
    width = 1 / 2,
    presets = [1 / 3, 1 / 2, 2 / 3],
    gap = 8,
  }: {
    /** A new column's width, as a proportion of the view's. */
    width?: number;
    /** The widths `cycleWidth` steps through, narrowest first. */
    presets?: readonly number[];
    gap?: number;
  } = $props();

  const { browser, capture, windows } = useDomicile();
  const list = watch(windows, "change", () => windows.list);
  const focused = watch(windows, "focuschange", () => windows.focused);
  const pages = watch(browser, "change", () => browser.windows);

  // A browser window's key; a native window's is its appId.
  const keyOf = (page: Page) => `browser:${page.id}`;
  const floats = (page: Page) => page.width > 0 || page.height > 0;

  // Menus and tooltips have a parent; the engine draws them with it.
  const apps = $derived(list.current.filter((window) => window.parent === undefined));
  const tiledPages = $derived((pages.current ?? []).filter((page) => !floats(page)));

  let columns = $state<Columns>([]);
  let viewWidth = $state(0);
  let viewHeight = $state(0);
  let scroll = $state(0);
  const across = $derived(spans(columns, { view: viewWidth, gap }));
  const boxes = $derived(place(columns, { view: viewWidth, gap, height: viewHeight }));

  // The window that holds the keyboard, or held it last while shell UI (a
  // popup, a launcher) has it. Native focus reports itself; a browser window
  // is the shell's own page, so the shell tracks it here.
  let active = $state<string>();
  // bind:this sets a closed page's entry to null.
  const frames: Record<string, BrowserWindow | null> = {};
  // Oldest first. A closed window's key stays until it is shown or parked
  // again; `listing` leaves it out.
  let parked = $state<string[]>([]);

  // The effects below read the state they write untracked: tracked, each
  // write would rerun the effect that made it.
  $effect(() => {
    const now = focused.current;
    if (now !== undefined) {
      active = now;
      // A parked app that takes the keyboard (one asked to open again) comes
      // back.
      untrack(() => {
        if (parked.includes(now)) {
          parked = parked.filter((key) => key !== now);
        }
      });
    }
  });

  $effect(() => {
    const open = [...apps.map((window) => window.appId), ...tiledPages.map(keyOf)].filter(
      (key) => !parked.includes(key),
    );
    const at = active;
    columns = untrack(() => sync($state.snapshot(columns) as Columns, open, at, width));
  });

  $effect(() => {
    const span = across[columnOf(columns, active)];
    if (span !== undefined && viewWidth > 0) {
      const view = viewWidth;
      scroll = untrack(() => scrollTo(scroll, span, view));
    }
  });

  // Rearranges the strip around the active window; it keeps the keyboard.
  const rearrange = (change: (columns: Columns, key: string) => Columns) => {
    if (active !== undefined) {
      columns = change($state.snapshot(columns) as Columns, active);
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
    apps.some((window) => window.appId === key) || (pages.current ?? []).some((page) => keyOf(page) === key);

  const focus = (key: string) => {
    if (!(pages.current ?? []).some((page) => keyOf(page) === key)) {
      releasePage();
      windows.focus(key);
      return;
    }
    // A page that closed before its frame mounted, as a popup can, has none.
    const frame = frames[key];
    if (frame !== undefined && frame !== null) {
      active = key;
      windows.focusShell();
      frame.focus();
    }
  };

  // A page that opens takes the keyboard, as a native window does
  // (focusNewWindows). Pages open when the list first arrives were there
  // before this shell, as after `domicile load-shell`, and are left alone.
  let seen: Set<string> | undefined;
  $effect(() => {
    const current = pages.current;
    if (current === undefined) {
      return;
    }
    const keys = current.map(keyOf);
    untrack(() => {
      const fresh = seen === undefined ? [] : keys.filter((key) => !seen?.has(key));
      seen = new Set(keys);
      const last = fresh.at(-1);
      if (last !== undefined) {
        // Its frame mounts on the next render.
        void tick().then(() => focus(last));
      }
    });
  });

  /** Give the keyboard back to the window that last held it. */
  export const refocus = () => {
    if (active !== undefined && exists(active)) {
      focus(active);
    }
  };

  /** Focus the neighbor of the active window in `direction`. */
  export const move = (direction: Direction) => {
    const next = neighbor(columns, active, direction);
    if (next !== undefined) {
      focus(next);
    }
  };

  /** Ask the active window to close. */
  export const close = () => {
    const page = (pages.current ?? []).find((each) => keyOf(each) === active);
    if (page !== undefined) {
      browser.close(page.id);
    } else if (active !== undefined && exists(active)) {
      windows.close(active);
    }
  };

  /** Focus the first or last column, in the active window's row. */
  export const moveToEdge = (end: "first" | "last") => {
    const next = edge(columns, active, end);
    if (next !== undefined) {
      focus(next);
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
  export const moveWindow = (direction: "up" | "down") =>
    rearrange((now, key) => windowMoved(now, key, direction));

  /** Maximize the active window's column, or give it back its width. */
  export const maximize = () => rearrange(toggleFull);

  /** Step the active window's column through `presets`. */
  export const cycleWidth = () => rearrange((now, key) => nextPreset(now, key, presets));

  /** Scroll the active window's column to the middle of the view. */
  export const center = () => {
    const span = across[columnOf(columns, active)];
    if (span !== undefined) {
      scroll = centered(span, viewWidth);
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
    parked = [...parked, key];
    if (next === undefined) {
      active = undefined;
      releasePage();
      windows.focusShell();
    } else {
      focus(next);
    }
  };

  /** Bring `key` back, parked or not, and give it the keyboard. */
  export const show = async (key: string) => {
    if (parked.includes(key)) {
      parked = parked.filter((each) => each !== key);
      // Placed beside the active window once the columns follow.
      await tick();
    }
    focus(key);
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
    const order = columns.flatMap((column) => column.windows);
    return [...native, ...browsers]
      .map((window) => ({ ...window, parked: parked.includes(window.key) }))
      .sort((a, b) => Number(a.parked) - Number(b.parked) || order.indexOf(a.key) - order.indexOf(b.key));
  };

  // A window whose tile animates to a new size is frozen, as niri does it:
  //
  // 1. It keeps its old size, stretched with the tile, while the shell takes a
  //    still of it (capture.preview).
  // 2. The still covers it, stretched to the tile, and the window takes its
  //    final size under it, unseen, so its client draws at that size while the
  //    tile moves.
  // 3. Once the tile has stopped and the client has committed the new size
  //    (a browser window: two frames, as its view holds the page's frame until
  //    it draws), the still goes and the window shows.
  //
  // Resizing the client at the end showed its old frame in part of the new
  // box; resizing it at the start showed it unready. With no still, it is
  // resized at the end; with no commit, the still goes after READY_MS.
  const reducedMotion = new MediaQuery("prefers-reduced-motion: reduce");
  // The tiles' move and resize timing, which the CSS reads as --glide.
  const GLIDE_MS = 220;
  const GLIDE_CURVE = "cubic-bezier(0.2, 0, 0, 1)";
  const READY_MS = 1000;

  type Size = { width: number; height: number };
  type Freeze = {
    /** The size the window keeps until it has a still. */
    old: Size;
    target: Size;
    /** The still, once taken: the window then has `target` under it. */
    still: string | undefined;
    /** The tile is animating. */
    moving: boolean;
    /** A native window's committed size when the freeze began. */
    committed: Size | undefined;
    /** A browser window drew at `target`. */
    pageDrawn: boolean;
  };

  const freezes = new SvelteMap<string, Freeze>();
  const surfaces: Record<string, HTMLElement | null> = {};
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let lastBoxes = new Map<string, Size>();

  // Ends a freeze: the window shows at its tile's size, unscaled.
  const thaw = (key: string) => {
    clearTimeout(timers.get(key));
    for (const running of surfaces[key]?.getAnimations() ?? []) {
      running.cancel();
    }
    freezes.delete(key);
  };

  const update = (key: string, change: Partial<Freeze>) => {
    const freeze = freezes.get(key);
    if (freeze !== undefined) {
      freezes.set(key, { ...freeze, ...change });
    }
  };

  const committedOf = (key: string): Size | undefined => {
    const window = list.current.find((each) => each.appId === key);
    return window?.width === undefined || window.height === undefined
      ? undefined
      : { width: window.width, height: window.height };
  };

  const pageIdOf = (key: string) => (pages.current ?? []).find((page) => keyOf(page) === key)?.id;

  // Scale the old-size window from where the tile is now to `to`.
  const stretchOld = (key: string, old: Size, to: Size) => {
    const surface = surfaces[key];
    const tile = surface?.parentElement;
    if (surface === undefined || surface === null || tile === undefined || tile === null) {
      return;
    }
    const now = tile.getBoundingClientRect();
    for (const running of surface.getAnimations()) {
      running.cancel();
    }
    surface.animate(
      [{ scale: `${now.width / old.width} ${now.height / old.height}` }, { scale: `${to.width / old.width} ${to.height / old.height}` }],
      { duration: GLIDE_MS, easing: GLIDE_CURVE, fill: "forwards" },
    );
  };

  const drawnTwice = (key: string) =>
    requestAnimationFrame(() => requestAnimationFrame(() => update(key, { pageDrawn: true })));

  const takeStill = (key: string) => {
    const page = pageIdOf(key);
    capture
      .preview(page === undefined ? PreviewedWindow.App(key) : PreviewedWindow.Browser(page))
      .then((taken) =>
        taken.match({
          Ok: (still) => {
            if (freezes.has(key)) {
              for (const running of surfaces[key]?.getAnimations() ?? []) {
                running.cancel();
              }
              update(key, { still });
              if (page !== undefined) {
                drawnTwice(key);
              }
            }
          },
          Err: (error) => console.error("[windows] no still of", key, error),
        }),
      )
      .catch((error: unknown) => console.error("[windows] no still of", key, error));
  };

  const stopped = (key: string) => {
    clearTimeout(timers.get(key));
    update(key, { moving: false });
    timers.set(
      key,
      setTimeout(() => thaw(key), READY_MS),
    );
  };

  const freeze = (key: string, before: Size, box: Size) => {
    const target = { width: box.width, height: box.height };
    const current = freezes.get(key);
    if (current === undefined) {
      freezes.set(key, {
        old: before,
        target,
        still: undefined,
        moving: true,
        committed: committedOf(key),
        pageDrawn: false,
      });
      takeStill(key);
    } else {
      update(key, { target, moving: true, pageDrawn: false });
      if (current.still !== undefined && pageIdOf(key) !== undefined) {
        drawnTwice(key);
      }
    }
    const old = freezes.get(key)?.old ?? before;
    if (freezes.get(key)?.still === undefined) {
      stretchOld(key, old, target);
    }
    // Ends the move if the tile's transitionend never comes.
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => stopped(key), GLIDE_MS * 2),
    );
  };

  $effect(() => {
    const next = boxes;
    untrack(() => {
      for (const [key, box] of next) {
        const before = lastBoxes.get(key);
        const resized = before !== undefined && (before.width !== box.width || before.height !== box.height);
        if (resized && before.width > 0 && before.height > 0 && !reducedMotion.current) {
          freeze(key, before, box);
        }
      }
      for (const key of [...freezes.keys()]) {
        if (!next.has(key)) {
          thaw(key);
        }
      }
      lastBoxes = new Map([...next].map(([key, box]) => [key, { width: box.width, height: box.height }]));
    });
  });

  // The swap: the tile stopped, and the window is ready at its new size.
  $effect(() => {
    for (const [key, each] of freezes) {
      if (each.moving) {
        continue;
      }
      const committed = committedOf(key);
      const near = (a: Size, b: Size) => Math.abs(a.width - b.width) <= 1 && Math.abs(a.height - b.height) <= 1;
      const ready =
        each.still === undefined ||
        (pageIdOf(key) === undefined
          ? committed !== undefined &&
            (near(committed, each.target) || (each.committed !== undefined && !near(committed, each.committed)))
          : each.pageDrawn);
      if (ready) {
        untrack(() => thaw(key));
      }
    }
  });

  // Both of a tile's size transitions end together; the first ends the move.
  const sizeSettled = (event: TransitionEvent, key: string) => {
    if (
      freezes.has(key) &&
      event.target === event.currentTarget &&
      (event.propertyName === "width" || event.propertyName === "height")
    ) {
      stopped(key);
    }
  };

  $effect(() => () => {
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
  });

  const floatBox = (page: Page) => {
    const w = Math.min(page.width || 480, viewWidth);
    const h = Math.min(page.height || 640, viewHeight);
    return { x: (viewWidth - w) / 2, y: (viewHeight - h) / 2, width: w, height: h };
  };
</script>

<div
  class="view"
  bind:clientWidth={viewWidth}
  bind:clientHeight={viewHeight}
  style:--glide="{GLIDE_MS}ms"
  style:--glide-curve={GLIDE_CURVE}
>
  <!-- Two append-only lists, so no element ever moves in the document: a
       moved <webview> reconnects, and its page shows in one view at a time. -->
  {#each apps as window (window.appId)}
    {@const box = boxes.get(window.appId)}
    {@const frozen = freezes.get(window.appId)}
    {@const size = frozen && (frozen.still === undefined ? frozen.old : frozen.target)}
    <div
      class="tile"
      class:hidden={box === undefined}
      class:active={window.appId === active}
      style:translate="{(box?.x ?? 0) - scroll}px {box?.y ?? 0}px"
      style:width="{box?.width ?? 0}px"
      style:height="{box?.height ?? 0}px"
      ontransitionend={(event) => sizeSettled(event, window.appId)}
    >
      <div
        class="surface"
        class:under={frozen?.still !== undefined}
        bind:this={surfaces[window.appId]}
        style:width={size && `${size.width}px`}
        style:height={size && `${size.height}px`}
      >
        <app app-id={window.appId}></app>
      </div>
      {#if frozen?.still !== undefined}<img class="still" src={frozen.still} alt="" />{/if}
    </div>
  {/each}
  {#each pages.current ?? [] as page (page.id)}
    {@const key = keyOf(page)}
    {@const floating = floats(page)}
    {@const box = parked.includes(key) ? undefined : floating ? floatBox(page) : boxes.get(key)}
    {@const frozen = floating ? undefined : freezes.get(key)}
    {@const size = frozen && (frozen.still === undefined ? frozen.old : frozen.target)}
    <div
      class="tile"
      class:floating
      class:hidden={box === undefined}
      class:active={key === active}
      style:translate={floating ? `${box?.x ?? 0}px ${box?.y ?? 0}px` : `${(box?.x ?? 0) - scroll}px ${box?.y ?? 0}px`}
      style:width="{box?.width ?? 0}px"
      style:height="{box?.height ?? 0}px"
      ontransitionend={(event) => sizeSettled(event, key)}
    >
      {#if frozen?.still !== undefined}<img class="still" src={frozen.still} alt="" />{/if}
      <div
        class="surface"
        class:under={frozen?.still !== undefined}
        bind:this={surfaces[key]}
        style:width={size && `${size.width}px`}
        style:height={size && `${size.height}px`}
      >
        <BrowserWindow
          bind:this={frames[key]}
          window={page}
          onfocus={() => {
            active = key;
            windows.focusShell();
          }}
          onfocusrequest={() => focus(key)}
        />
      </div>
    </div>
  {/each}
</div>

<style>
  .view {
    position: relative;
    flex: 1;
    min-height: 0;
    margin: 8px 0;
    overflow: hidden;
  }

  .tile {
    position: absolute;
    top: 0;
    left: 0;
    border-radius: 8px;
    overflow: hidden;
    /* Moves and resizes glide: scrolling, a new width, consume and expel. */
    transition:
      translate var(--glide) var(--glide-curve),
      width var(--glide) var(--glide-curve),
      height var(--glide) var(--glide-curve);
  }

  /* The window inside a tile. While the tile resizes, it is frozen: see
     `freeze`. */
  .surface {
    width: 100%;
    height: 100%;
    transform-origin: 0 0;
  }

  /* At its new size under the still while its client catches up. Not
     hidden: a hidden <app> reports no area and its window stops drawing. */
  .under {
    opacity: 0;
  }

  .still {
    position: absolute;
    inset: 0;
    z-index: 1;
    width: 100%;
    height: 100%;
    object-fit: fill;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .tile {
      transition: none;
    }
  }

  /* Not placed yet. A page under display: none stays mounted, as a
     background tab. */
  .hidden {
    display: none;
  }

  .floating {
    z-index: 1;
    box-shadow: 0 8px 32px #000a;
    transition: none;
  }

  /* Over the window: a native window is a layer that would cover an inset
     outline, and the view clips one drawn outside. */
  .active::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    border: 2px solid #74c7ec;
    border-radius: inherit;
    pointer-events: none;
  }

  app {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
