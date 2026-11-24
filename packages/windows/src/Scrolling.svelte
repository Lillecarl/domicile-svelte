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
  import { type Entry, Menu } from "@domicile-svelte/menu";
  import { useDomicile, watch } from "@domicile-svelte/svelte";
  import { tick, untrack } from "svelte";
  import { MediaQuery, SvelteMap } from "svelte/reactivity";

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
    place,
    scrollTo,
    spans,
    sync,
    toggleFull,
  } from "./columns";
  import {
    boundsOf,
    clampPan,
    type Drop,
    dropAt,
    dropped,
    markOf,
    panTo,
    parkedRow,
    ROW_GAP,
    type Size,
    zoomFor,
  } from "./overview";
  import { popupsOf } from "./popups";

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

  // Menus and tooltips have a parent, and are drawn over it.
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
  // What each was sized when it was parked: shown again at that, its client
  // need not draw anew.
  const parkedSizes: Record<string, Size> = {};
  let overview = $state(false);

  // The effects below read the state they write untracked: tracked, each
  // write would rerun the effect that made it.
  $effect(() => {
    const now = focused.current;
    if (now !== undefined) {
      active = now;
      // A parked app that takes the keyboard (one asked to open again) comes
      // back.
      untrack(() => {
        overview = false;
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
  // a closed or narrowed column leaves no empty space behind. A pre effect, so
  // the scroll reaches the DOM in the same update as the boxes: a later update
  // would settle from a start that already holds the new boxes, and the strip
  // would jump. Not in the overview, which pans instead.
  $effect.pre(() => {
    const span = across[columnOf(columns, active)];
    const strip = across;
    const view = viewWidth;
    if (view > 0 && !overview) {
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
  const rearrange = (change: (columns: Columns, key: string) => Columns, also?: () => void) => {
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
        // In the same update, so the tiles settle from where both left them.
        also?.();
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
    // The overview has the keyboard, and hands it to the window it closes on.
    if (overview) {
      active = key;
      return;
    }
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
  export const moveWindow = (direction: "up" | "down") => rearrange((now, key) => windowMoved(now, key, direction));

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

  /** Bring `key` back, parked or not, and give it the keyboard. */
  export const show = async (key: string) => {
    overview = false;
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
    return { x: (viewWidth - w) / 2, y: (viewHeight - h) / 2, width: w, height: h };
  };

  let strip = $state<HTMLElement>();
  const parkedBoxes = $derived.by(() => {
    if (!overview) {
      return new Map<string, Box>();
    }
    const sizes = parked.flatMap((key): [string, Size][] => {
      const page = (pages.current ?? []).find((each) => keyOf(each) === key);
      if (page === undefined && !exists(key)) {
        return [];
      }
      const fallback = page !== undefined && floats(page) ? floatBox(page) : undefined;
      return [[key, parkedSizes[key] ?? fallback ?? { width: (viewWidth - gap) * width, height: viewHeight }]];
    });
    return parkedRow(new Map(sizes), { strip: across.at(-1)?.end ?? 0, height: viewHeight, gap });
  });

  // Before the DOM takes the new boxes. Parked windows too: the first run is
  // at once, so all it reads is declared above.
  $effect.pre(() => {
    void boxes;
    void scroll;
    void parkedBoxes;
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
    void parkedBoxes;
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

  // A page's context menu. Drawn out of its tile, whose transform and clip
  // would place it.
  let menu = $state.raw<{ entries: Entry[]; x: number; y: number }>();

  // The overview: the strip's box, drawn smaller by a transform. The windows
  // keep their layout, so no client draws anew, and stay live. A layer over
  // them takes the pointer and the keyboard.
  let layer = $state<HTMLElement | null>();
  const view = $derived({ width: viewWidth, height: viewHeight });
  const bounds = $derived(
    boundsOf([{ x: 0, y: 0, width: 0, height: viewHeight }, ...boxes.values(), ...parkedBoxes.values()]),
  );
  const zoom = $derived(zoomFor(bounds, view));
  let wanted = $state(0);
  const pan = $derived(clampPan(wanted, bounds, view, zoom));
  const top = $derived((viewHeight - zoom * bounds.height) / 2 - zoom * bounds.y);
  const camera = $derived(
    overview ? `translate(${viewWidth / 2 - zoom * (pan - scroll)}px, ${top}px) scale(${zoom})` : "none",
  );

  // The active window in the overview's view.
  $effect.pre(() => {
    const box = active === undefined ? undefined : (boxes.get(active) ?? parkedBoxes.get(active));
    if (overview && box !== undefined) {
      wanted = untrack(() => panTo(pan, box, view, zoom));
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
      releasePage();
      overview = true;
    }
  };

  let drag = $state<{ key: string; from: { x: number; y: number }; by: { x: number; y: number } }>();
  let dropping = $state<Drop | "park">();
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
      dropping = at.y > viewHeight + ROW_GAP / 2 ? "park" : dropAt(columns, boxes, key, at);
    }
  };

  const unpark = async (key: string) => {
    parked = parked.filter((each) => each !== key);
    // Beside the active window once the columns follow.
    await tick();
  };

  const drop = async (key: string, where: Drop | "park" | undefined) => {
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
      if (columnOf(columns, key) === -1) {
        letGo();
      } else {
        rearrange((now) => dropped(now, key, where, width), letGo);
      }
    }
  };

  const release = () => {
    const { key } = pressed ?? {};
    pressed = undefined;
    if (drag !== undefined) {
      void drop(drag.key, dropping);
    } else if (key === undefined) {
      toggleOverview();
    } else {
      void show(key);
    }
  };

  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    wanted = clampPan(pan + (event.deltaX || event.deltaY) / zoom, bounds, view, zoom);
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
      move(direction);
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
      ? { x: 0, y: viewHeight + ROW_GAP / 2, width: Math.max(viewWidth, bounds.width), height: gap }
      : dropping === undefined
        ? undefined
        : markOf(columns, boxes, dropping, gap),
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

<div class="view" bind:clientWidth={viewWidth} bind:clientHeight={viewHeight}>
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
      <div
        class="tile"
        class:floating
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
          onfocus={() => {
            active = key;
            windows.focusShell();
          }}
          onfocusrequest={() => focus(key)}
          onmenu={(entries, x, y) => (menu = { entries, x, y })}
        />
        {@render still(key)}
      </div>
    {/each}
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

{#if menu !== undefined}
  {#key menu}
    <Menu
      entries={menu.entries}
      x={menu.x}
      y={menu.y}
      label="Page"
      onclose={() => {
        menu = undefined;
        refocus();
      }}
    />
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
