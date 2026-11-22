<script lang="ts">
  import { useDomicile } from "./desktop";
  import { watch } from "./watch.svelte";

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
