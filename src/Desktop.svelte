<script lang="ts">
  import { useDomicile } from "./desktop";
  import { watch } from "./watch.svelte";

  const domicile = useDomicile();

  const windows = watch(domicile.windows, "change", () => domicile.windows.list);
  const focused = watch(domicile.windows, "focuschange", () => domicile.windows.focused);
  // Menus and tooltips have a parent; they are not tiled.
  const tiled = $derived(windows.current.filter((window) => window.parent === undefined));

  const terminal = () => domicile.processes.launch(["kitty"]);

  $effect(() => {
    domicile.keyboard.grab("Meta+Return");
    const unlisten = domicile.keyboard.on("shortcut", ({ chord }) => {
      if (chord === "Meta+Return") {
        terminal();
      }
    });
    return () => {
      unlisten();
      domicile.keyboard.ungrab("Meta+Return");
    };
  });
</script>

<main>
  {#each tiled as window (window.appId)}
    <app app-id={window.appId} class:focused={window.appId === focused.current}></app>
  {/each}
</main>

<style>
  main {
    display: flex;
    gap: 8px;
    height: 100vh;
    padding: 8px;
    box-sizing: border-box;
    background: #1e1e2e;
  }

  app {
    flex: 1;
    border-radius: 8px;
  }

  .focused {
    outline: 2px solid #74c7ec;
  }
</style>
