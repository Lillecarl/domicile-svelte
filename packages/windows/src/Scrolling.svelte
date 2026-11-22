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
    filled,
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
    settle = 220,
  }: {
    /** How long a tile takes to ease into a new box, in milliseconds. */
    settle?: number;
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

  // The active column in view, and the view filled where the strip allows, so
  // a closed or narrowed column leaves no empty space behind.
  $effect(() => {
    const span = across[columnOf(columns, active)];
    const strip = across;
    const view = viewWidth;
    if (view > 0) {
      scroll = untrack(() => filled(span === undefined ? scroll : scrollTo(scroll, span, view), strip, view));
    }
  });

  // The windows that held the keyboard, most recent first. A closed one goes;
  // a parked one stays, for when it is shown again.
  let history: string[] = [];
  $effect(() => {
    const now = active;
    if (now !== undefined) {
      history = [now, ...history.filter((key) => key !== now)];
    }
  });

  // The active window closed: the keyboard goes to the window that held it
  // before, as a closed tab hands it to the tab used last.
  let present: string[] = [];
  $effect(() => {
    const now = [...apps.map((window) => window.appId), ...(pages.current ?? []).map(keyOf)];
    untrack(() => {
      const closed = present.filter((key) => !now.includes(key));
      present = now;
      if (closed.length === 0) {
        return;
      }
      history = history.filter((key) => now.includes(key));
      if (active === undefined || !closed.includes(active)) {
        return;
      }
      const next =
        history.find((key) => !parked.includes(key)) ??
        columns.flatMap((column) => column.windows).find((key) => now.includes(key) && !parked.includes(key));
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
  const rearrange = (change: (columns: Columns, key: string) => Columns) => {
    const key = active;
    if (key === undefined) {
      return;
    }
    rearranging = rearranging
      .then(async () => {
        const area = { view: viewWidth, gap, height: viewHeight };
        const before = place($state.snapshot(columns) as Columns, area);
        const after = place(change($state.snapshot(columns) as Columns, key), area);
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
        columns = change($state.snapshot(columns) as Columns, key);
      })
      .catch((error: unknown) => console.error("[windows] rearranging", error));
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

  // Decoded before it is shown, so its first frame has it.
  const stillOf = async (key: string): Promise<string | undefined> => {
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
    const fading = image.animate([{ opacity: 1 }, { opacity: 0 }], { duration: settle, easing: SETTLE_CURVE, fill: "forwards" });
    fading.onfinish = () => {
      if (stills.get(key) === still) {
        stills.delete(key);
      }
    };
  };

  // Before the DOM takes the new boxes.
  $effect.pre(() => {
    void boxes;
    void scroll;
    untrack(() => {
      drawnBefore = new Map();
      for (const [key, tile] of Object.entries(tiles)) {
        if (tile !== null) {
          drawnBefore.set(key, tile.getBoundingClientRect());
        }
      }
    });
  });

  $effect(() => {
    void boxes;
    void scroll;
    untrack(() => {
      if (reducedMotion.current) {
        return;
      }
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
        const x = before.left - after.left;
        const y = before.top - after.top;
        const scaleX = before.width / after.width;
        const scaleY = before.height / after.height;
        if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5 && Math.abs(scaleX - 1) < 0.001 && Math.abs(scaleY - 1) < 0.001) {
          continue;
        }
        tile.animate(
          [{ transform: `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})` }, { transform: "none" }],
          { duration: settle, easing: SETTLE_CURVE },
        );
      }
    });
  });

  const floatBox = (page: Page) => {
    const w = Math.min(page.width || 480, viewWidth);
    const h = Math.min(page.height || 640, viewHeight);
    return { x: (viewWidth - w) / 2, y: (viewHeight - h) / 2, width: w, height: h };
  };
</script>

{#snippet still(key: string)}
  {@const url = stills.get(key)}
  {#if url !== undefined}
    <img class="still" src={url} alt="" bind:this={stillImages[key]} />
  {/if}
{/snippet}

<div class="view" bind:clientWidth={viewWidth} bind:clientHeight={viewHeight}>
  <!-- Two append-only lists, so no element ever moves in the document: a
       moved <webview> reconnects, and its page shows in one view at a time. -->
  {#each apps as window (window.appId)}
    {@const box = boxes.get(window.appId)}
    <div
      class="tile"
      class:hidden={box === undefined}
      class:active={window.appId === active}
      bind:this={tiles[window.appId]}
      style:translate="{(box?.x ?? 0) - scroll}px {box?.y ?? 0}px"
      style:width="{box?.width ?? 0}px"
      style:height="{box?.height ?? 0}px"
    >
      <app app-id={window.appId}></app>
      {@render still(window.appId)}
    </div>
  {/each}
  {#each pages.current ?? [] as page (page.id)}
    {@const key = keyOf(page)}
    {@const floating = floats(page)}
    {@const box = parked.includes(key) ? undefined : floating ? floatBox(page) : boxes.get(key)}
    <div
      class="tile"
      class:floating
      class:hidden={box === undefined}
      class:active={key === active}
      bind:this={tiles[key]}
      style:translate={floating ? `${box?.x ?? 0}px ${box?.y ?? 0}px` : `${(box?.x ?? 0) - scroll}px ${box?.y ?? 0}px`}
      style:width="{box?.width ?? 0}px"
      style:height="{box?.height ?? 0}px"
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
      {@render still(key)}
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
    /* The settle's transform scales and moves from the tile's corner. */
    transform-origin: 0 0;
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
