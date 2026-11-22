<script lang="ts">
  import { Bar } from "@domicile-svelte/bar";
  import Clock from "@domicile-svelte/bar-clock";
  import Extensions from "@domicile-svelte/bar-extensions";
  import Keymap from "@domicile-svelte/bar-keymap";
  import Tray from "@domicile-svelte/bar-tray";
  import Volume from "@domicile-svelte/bar-volume";
  import WindowTitle from "@domicile-svelte/bar-window-title";
  import { useDomicile } from "@domicile-svelte/svelte";
  import { focusNewWindows, Scrolling } from "@domicile-svelte/windows";

  const domicile = useDomicile();
  $effect(() => focusNewWindows(domicile.windows));

  let layout = $state<ReturnType<typeof Scrolling>>();
  const launch = (argv: string[]) => () => domicile.processes.launch(argv);

  const bindings: Record<string, () => void> = {
    "Meta+Return": launch(["kitty"]),
    // croshome installs `domicile-quit`: SIGTERM to the launcher.
    "Meta+Shift+E": launch(["domicile-quit"]),
    "Meta+h": () => layout?.move("left"),
    "Meta+j": () => layout?.move("down"),
    "Meta+k": () => layout?.move("up"),
    "Meta+l": () => layout?.move("right"),
  };

  $effect(() => {
    for (const chord of Object.keys(bindings)) {
      domicile.keyboard.grab(chord);
    }
    const unlisten = domicile.keyboard.on("shortcut", ({ chord }) => bindings[chord]?.());
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
    {#snippet right()}<Volume /><Extensions /><Tray /><Clock />{/snippet}
  </Bar>
  <Scrolling bind:this={layout} />
</div>

<style>
  .desktop {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 0 8px;
    box-sizing: border-box;
    background: #1e1e2e;
  }
</style>
