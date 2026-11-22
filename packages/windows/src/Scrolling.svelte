<!--
  Windows in columns on a strip that scrolls to keep the focused column in
  view, as niri lays them out. `move` focuses the neighbor in a direction;
  bind keys to it.
-->
<script lang="ts">
  import { useDomicile, watch } from "@domicile-svelte/svelte";
  import { untrack } from "svelte";

  import { type Columns, columnOf, type Direction, neighbor, scrollTo, sync } from "./columns";

  const {
    width = 0.5,
    gap = 8,
  }: {
    /** A column's width as a fraction of the view. */
    width?: number;
    gap?: number;
  } = $props();

  const { windows } = useDomicile();
  const list = watch(windows, "change", () => windows.list);
  const focused = watch(windows, "focuschange", () => windows.focused);

  let columns = $state<Columns>([]);
  let view = $state(0);
  let scroll = $state(0);
  const column = $derived(Math.max(0, (view - gap) * width));

  // Both effects read the state they write untracked: tracked, each write
  // would rerun the effect that made it.
  $effect(() => {
    // Menus and tooltips have a parent; they are not tiled.
    const open = list.current.filter((window) => window.parent === undefined).map((window) => window.appId);
    const at = focused.current;
    columns = untrack(() => sync($state.snapshot(columns) as Columns, open, at));
  });

  $effect(() => {
    const index = columnOf(columns, focused.current);
    const sizes = { column, gap, view };
    if (index !== -1 && view > 0) {
      scroll = untrack(() => scrollTo(scroll, index, sizes));
    }
  });

  export const move = (direction: Direction) => {
    const next = neighbor(columns, focused.current, direction);
    if (next !== undefined) {
      windows.focus(next);
    }
  };
</script>

<div class="view" bind:clientWidth={view}>
  <div class="strip" style:gap="{gap}px" style:translate="{-scroll}px 0">
    {#each columns as stack, index (stack[0])}
      <div class="column" style:width="{column}px" style:gap="{gap}px" data-index={index}>
        {#each stack as appId (appId)}
          <app app-id={appId} class:focused={appId === focused.current}></app>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .view {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: 8px 0;
  }

  .strip {
    display: flex;
    height: 100%;
    transition: translate 180ms ease-out;
  }

  .column {
    display: flex;
    flex: none;
    flex-direction: column;
    height: 100%;
  }

  app {
    flex: 1;
    min-height: 0;
    border-radius: 8px;
  }

  .focused {
    outline: 2px solid #74c7ec;
  }
</style>
