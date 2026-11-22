<script lang="ts">
  import { Bar } from "@domicile-svelte/bar";
  import Clock from "@domicile-svelte/bar-clock";
  import Keymap from "@domicile-svelte/bar-keymap";
  import Tray from "@domicile-svelte/bar-tray";
  import Volume from "@domicile-svelte/bar-volume";
  import WindowTitle from "@domicile-svelte/bar-window-title";
  import { useDomicile, watch } from "@domicile-svelte/svelte";

  const domicile = useDomicile();

  const windows = watch(domicile.windows, "change", () => domicile.windows.list);
  const focused = watch(domicile.windows, "focuschange", () => domicile.windows.focused);
  // Menus and tooltips have a parent; they are not tiled.
  const tiled = $derived(windows.current.filter((window) => window.parent === undefined));

  // croshome installs `domicile-quit`: SIGTERM to the launcher.
  const bindings: Record<string, string[]> = {
    "Meta+Return": ["kitty"],
    "Meta+Shift+E": ["domicile-quit"],
  };

  $effect(() => {
    for (const chord of Object.keys(bindings)) {
      domicile.keyboard.grab(chord);
    }
    const unlisten = domicile.keyboard.on("shortcut", ({ chord }) => {
      const argv = bindings[chord];
      if (argv !== undefined) {
        domicile.processes.launch(argv);
      }
    });
    return () => {
      unlisten();
      for (const chord of Object.keys(bindings)) {
        domicile.keyboard.ungrab(chord);
      }
    };
  });
</script>

<div class="desktop">
  <Bar>
    {#snippet left()}<Keymap />{/snippet}
    {#snippet center()}<WindowTitle />{/snippet}
    {#snippet right()}<Volume /><Tray /><Clock />{/snippet}
  </Bar>
  <main>
    {#each tiled as window (window.appId)}
      <app app-id={window.appId} class:focused={window.appId === focused.current}></app>
    {/each}
  </main>
</div>

<style>
  .desktop {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #1e1e2e;
  }

  main {
    display: flex;
    flex: 1;
    gap: 8px;
    min-height: 0;
    padding: 8px;
  }

  app {
    flex: 1;
    border-radius: 8px;
  }

  .focused {
    outline: 2px solid #74c7ec;
  }
</style>
