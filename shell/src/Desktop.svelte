<script lang="ts">
  import { Bar } from "@domicile-svelte/bar";
  import Clock from "@domicile-svelte/bar-clock";
  import Extensions from "@domicile-svelte/bar-extensions";
  import Keymap from "@domicile-svelte/bar-keymap";
  import Tray from "@domicile-svelte/bar-tray";
  import Volume from "@domicile-svelte/bar-volume";
  import WindowTitle from "@domicile-svelte/bar-window-title";
  import { installedSource, Launcher, matching, type Source } from "@domicile-svelte/launcher";
  import { Lock } from "@domicile-svelte/lock";
  import { useDomicile } from "@domicile-svelte/svelte";
  import { addressOf, focusNewWindows, Scrolling } from "@domicile-svelte/windows";

  // Inlined, so the bundle needs no asset served beside it. Traced with
  // potrace, a layer per color, from swaylock's picture in croshome
  // (hosts/shitbox/lockscreen.jpg), so it is sharp at any size.
  import lockscreen from "./assets/lockscreen.svg?inline";

  const domicile = useDomicile();
  $effect(() => focusNewWindows(domicile.windows));
  let layout = $state<ReturnType<typeof Scrolling>>();
  const launch = (argv: string[]) => () => domicile.processes.launch(argv);

  const apps = installedSource(domicile);

  const web: Source = {
    search: (query) => {
      const address = addressOf(query);
      return address === undefined
        ? []
        : [
            {
              key: "web",
              label: address.kind === "url" ? address.url : `Search the web for “${address.words}”`,
              detail: "browser",
              icon: apps.icon("web-browser"),
              run: () => domicile.browser.open(address.url),
            },
          ];
    },
  };

  const windowList: Source = {
    search: (query) =>
      matching(layout?.listing() ?? [], query, (window) => [window.title, window.app]).map((window) => ({
        key: `window:${window.key}`,
        label: window.title,
        detail: window.parked ? `${window.app} · parked` : window.app,
        icon: window.app === "browser" ? apps.icon("web-browser") : apps.appIcon(window.app),
        run: () => layout?.show(window.key),
      })),
  };

  let launcher = $state<{ sources: Source[]; placeholder: string }>();
  const openLauncher = (sources: Source[], placeholder: string) => {
    launcher = { sources, placeholder };
  };
  const closeLauncher = () => {
    if (launcher !== undefined) {
      launcher = undefined;
      layout?.refocus();
    }
  };

  const bindings: Record<string, () => void> = {
    "Meta+Return": launch(["kitty"]),
    // croshome installs `domicile-quit`: SIGTERM to the launcher.
    "Meta+Shift+E": launch(["domicile-quit"]),
    "Meta+b": () => domicile.browser.open("about:blank"),
    "Meta+q": () => layout?.close(),
    "Meta+d": () => {
      apps.reload().catch((error: unknown) => console.error("[launcher] apps:", error));
      openLauncher([apps, web], "Run an app, or open an address");
    },
    "Meta+Tab": () => {
      // Window rows take their app's icon from the entries.
      apps.reload().catch((error: unknown) => console.error("[launcher] apps:", error));
      openLauncher([windowList], "Windows");
    },
    "Meta+p": () => layout?.park(),
    // swaylock's key under niri.
    "Ctrl+Alt+Delete": () => domicile.session.lock(),
    // The layout keys as croshome's niri config binds them.
    "Meta+h": () => layout?.move("left"),
    "Meta+j": () => layout?.move("down"),
    "Meta+k": () => layout?.move("up"),
    "Meta+l": () => layout?.move("right"),
    "Meta+Left": () => layout?.move("left"),
    "Meta+Down": () => layout?.move("down"),
    "Meta+Up": () => layout?.move("up"),
    "Meta+Right": () => layout?.move("right"),
    "Meta+Home": () => layout?.moveToEdge("first"),
    "Meta+End": () => layout?.moveToEdge("last"),
    "Meta+Ctrl+h": () => layout?.moveColumn("left"),
    "Meta+Ctrl+l": () => layout?.moveColumn("right"),
    "Meta+Ctrl+j": () => layout?.moveWindow("down"),
    "Meta+Ctrl+k": () => layout?.moveWindow("up"),
    "Meta+Ctrl+Left": () => layout?.moveColumn("left"),
    "Meta+Ctrl+Right": () => layout?.moveColumn("right"),
    "Meta+Ctrl+Down": () => layout?.moveWindow("down"),
    "Meta+Ctrl+Up": () => layout?.moveWindow("up"),
    "Meta+Ctrl+Home": () => layout?.moveColumn("first"),
    "Meta+Ctrl+End": () => layout?.moveColumn("last"),
    "Meta+comma": () => layout?.consume(),
    "Meta+period": () => layout?.expel(),
    "Meta+bracketleft": () => layout?.consumeOrExpel("left"),
    "Meta+bracketright": () => layout?.consumeOrExpel("right"),
    "Meta+r": () => layout?.cycleWidth(),
    "Meta+f": () => layout?.maximize(),
    "Meta+c": () => layout?.center(),
  };

  $effect(() => {
    for (const chord of Object.keys(bindings)) {
      // A chord the keyboard cannot type throws; the others still bind.
      try {
        domicile.keyboard.grab(chord);
      } catch (error) {
        console.error("[shell] grabbing", chord, error);
      }
    }
    const unlisten = domicile.keyboard.on("shortcut", ({ chord }) => bindings[chord]?.());
    return () => {
      unlisten();
      for (const chord of Object.keys(bindings)) {
        domicile.keyboard.ungrab(chord);
      }
    };
  });

  // How long tiles take to ease into a new box; `settle-ms` slows it down to
  // watch it.
  let settle = $state(220);

  // `domicile send-shell <command>...`: the layout actions by name, as niri
  // msg has them, for scripts and for testing without the keyboard.
  const commands: Record<string, (args: readonly string[]) => void> = {
    focus: ([direction]) => {
      if (direction === "left" || direction === "right" || direction === "up" || direction === "down") {
        layout?.move(direction);
      }
    },
    maximize: () => layout?.maximize(),
    "cycle-width": () => layout?.cycleWidth(),
    center: () => layout?.center(),
    consume: () => layout?.consume(),
    expel: () => layout?.expel(),
    "consume-or-expel": ([side]) => {
      if (side === "left" || side === "right") {
        layout?.consumeOrExpel(side);
      }
    },
    park: () => layout?.park(),
    close: () => layout?.close(),
    "settle-ms": ([ms]) => {
      const value = Number(ms);
      if (Number.isFinite(value) && value >= 0) {
        settle = value;
      }
    },
  };

  $effect(() => {
    let stop = () => {};
    const hear = async (items: ReadableStream<readonly string[]>) => {
      const reader = items.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          return;
        }
        const [name, ...args] = value;
        const command = name === undefined ? undefined : commands[name];
        if (command === undefined) {
          console.error("[shell] unknown command", value);
        } else {
          command(args);
        }
      }
    };
    domicile.shell
      .commands()
      .then((listening) =>
        listening.match({
          Ok: ({ items, stop: end }) => {
            stop = end;
            hear(items).catch((error: unknown) => console.error("[shell] commands", error));
          },
          Err: (error) => console.error("[shell] commands", error),
        }),
      )
      .catch((error: unknown) => console.error("[shell] commands", error));
    return () => stop();
  });
</script>

<!-- Not hidden under the lock screen, only covered: a hidden <app> reports no
     area, the compositor hides its window, and the keyboard handed back on
     unlock reaches a window not yet shown again. -->
<div class="desktop">
  <Bar>
    {#snippet left()}<Keymap />{/snippet}
    {#snippet center()}<WindowTitle />{/snippet}
    {#snippet right()}<Volume /><Extensions onclose={() => layout?.refocus()} /><Tray /><Clock />{/snippet}
  </Bar>
  <Scrolling bind:this={layout} {settle} />
  {#if launcher !== undefined}
    <!-- Opened again, it starts from an empty query. -->
    {#key launcher}
      <Launcher sources={launcher.sources} placeholder={launcher.placeholder} onclose={closeLauncher} />
    {/key}
  {/if}
</div>
<Lock background={lockscreen} onunlock={() => layout?.refocus()} />

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
