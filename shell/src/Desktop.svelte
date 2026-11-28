<script lang="ts">
  import { Err, Ok, type Result } from "@cprussin/option-result";
  import type { CommandRan, ShellCommand } from "@domicile-desktop/sdk/shell-command";
  import { type SystemError, SystemErrorKind } from "@domicile-desktop/sdk/system";
  import { Bar } from "@domicile-svelte/bar";
  import Cast from "@domicile-svelte/bar-cast";
  import Clock from "@domicile-svelte/bar-clock";
  import Downloads from "@domicile-svelte/bar-downloads";
  import Extensions from "@domicile-svelte/bar-extensions";
  import Idle from "@domicile-svelte/bar-idle";
  import Keymap from "@domicile-svelte/bar-keymap";
  import Monitor from "@domicile-svelte/bar-monitor";
  import NightLight from "@domicile-svelte/bar-night-light";
  import Notifications from "@domicile-svelte/bar-notifications";
  import Tray from "@domicile-svelte/bar-tray";
  import Volume from "@domicile-svelte/bar-volume";
  import WindowTitle from "@domicile-svelte/bar-window-title";
  import Workspaces from "@domicile-svelte/bar-workspaces";
  import { type Binding, Explorer } from "@domicile-svelte/keybinds";
  import { installedSource, Launcher, matching, type Source } from "@domicile-svelte/launcher";
  import { Lock } from "@domicile-svelte/lock";
  import PictureInPicture from "@domicile-svelte/pip";
  import { Capturing, picture, Portals } from "@domicile-svelte/portals";
  import { useDomicile, watch } from "@domicile-svelte/svelte";
  import { addressOf, focusNewWindows, providePageBar, Scrolling } from "@domicile-svelte/windows";

  // Inlined, so the bundle needs no asset served beside it. Traced with
  // potrace, a layer per color, from swaylock's picture in croshome
  // (hosts/shitbox/lockscreen.jpg), so it is sharp at any size.
  import lockscreen from "./assets/lockscreen.svg?inline";
  import { type Swipe, swipes } from "./swipes";

  const domicile = useDomicile();
  $effect(() => focusNewWindows(domicile.windows));
  const pageBar = providePageBar();
  let layout = $state<ReturnType<typeof Scrolling>>();
  const launch = (argv: string[]) => () => domicile.processes.launch(argv);

  const apps = installedSource(domicile);

  // What applications set through the Wallpaper portal.
  const wallpaper = watch(domicile.portals, "change", () => domicile.portals.wallpaper);
  const background = picture(() => wallpaper.current?.background);
  const lockPicture = picture(() => wallpaper.current?.lockscreen);

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

  const copies: Source = {
    search: (query) =>
      matching(domicile.clipboard.entries ?? [], query, ({ preview }) => [preview]).map((entry) => ({
        key: `copy:${entry.id}`,
        label: entry.preview,
        detail: entry.current ? "on the clipboard" : "",
        icon: entry.thumbnail,
        run: () => {
          domicile.clipboard.copy(entry.id);
          layout?.refocus();
        },
      })),
  };

  let keymap = $state<ReturnType<typeof Keymap>>();
  let cast = $state<ReturnType<typeof Cast>>();
  // The TV could show a toast.
  let isCasting = $state(false);
  let downloads = $state<ReturnType<typeof Downloads>>();
  let nightLight = $state<ReturnType<typeof NightLight>>();
  let monitor = $state<ReturnType<typeof Monitor>>();
  let notifications = $state<ReturnType<typeof Notifications>>();

  // Kept while closed: the launcher still reads its sources as it goes.
  let launcher = $state.raw<{ sources: Source[]; placeholder: string }>({ sources: [], placeholder: "" });
  let isLauncherOpen = $state(false);
  const openLauncher = (sources: Source[], placeholder: string) => {
    launcher = { sources, placeholder };
    isLauncherOpen = true;
  };
  const closeLauncher = () => {
    if (isLauncherOpen) {
      isLauncherOpen = false;
      layout?.refocus();
    }
  };

  const logged = <T extends {}>(what: string, asked: Promise<Result<T, SystemError>>) => {
    asked
      .then((answered) =>
        answered.match({
          Ok: () => undefined,
          Err: (error) => {
            if (error.kind !== SystemErrorKind.Canceled) {
              console.error("[shell]", what, error);
            }
          },
        }),
      )
      .catch((error: unknown) => console.error("[shell]", what, error));
  };

  // Each chord, what it does in words and what it runs. The explorer
  // (Meta+Shift+space) lists them by group.
  const keys: Binding[] = [
    { chord: "Meta+Return", group: "Apps", label: "Terminal", run: launch(["kitty"]) },
    { chord: "Meta+b", group: "Apps", label: "New browser window", run: () => domicile.browser.open("about:blank") },
    {
      chord: "Meta+d",
      group: "Apps",
      label: "Run an app, or open an address",
      run: () => {
        apps.reload().catch((error: unknown) => console.error("[launcher] apps:", error));
        openLauncher([apps, web], "Run an app, or open an address");
      },
    },
    {
      chord: "Meta+Tab",
      group: "Windows",
      label: "Find a window",
      run: () => {
        // Window rows take their app's icon from the entries.
        apps.reload().catch((error: unknown) => console.error("[launcher] apps:", error));
        openLauncher([windowList], "Windows");
      },
    },
    { chord: "Meta+v", group: "Apps", label: "Clipboard history", run: () => openLauncher([copies], "History") },
    { chord: "Meta+q", group: "Windows", label: "Close the window", run: () => layout?.close() },
    { chord: "Meta+p", group: "Windows", label: "Park the window", run: () => layout?.park() },
    { chord: "Meta+r", group: "Windows", label: "Cycle the column's width", run: () => layout?.cycleWidth() },
    { chord: "Meta+f", group: "Windows", label: "Maximize", run: () => layout?.maximize() },
    { chord: "Meta+Shift+F", group: "Windows", label: "Fullscreen", run: () => layout?.toggleFullscreen() },
    { chord: "Meta+c", group: "Windows", label: "Center the column", run: () => layout?.center() },
    {
      chord: "Meta+comma",
      group: "Windows",
      label: "Take the next window into the column",
      run: () => layout?.consume(),
    },
    {
      chord: "Meta+period",
      group: "Windows",
      label: "Put the window in a column of its own",
      run: () => layout?.expel(),
    },
    {
      chord: "Meta+bracketleft",
      group: "Windows",
      label: "Into or out of the column on the left",
      run: () => layout?.consumeOrExpel("left"),
    },
    {
      chord: "Meta+bracketright",
      group: "Windows",
      label: "Into or out of the column on the right",
      run: () => layout?.consumeOrExpel("right"),
    },
    // The layout keys as croshome's niri config binds them.
    ...(
      [
        ["h", "Left", "left"],
        ["j", "Down", "down"],
        ["k", "Up", "up"],
        ["l", "Right", "right"],
      ] as const
    ).flatMap(([letter, arrow, way]): Binding[] => [
      { chord: `Meta+${letter}`, group: "Focus", label: `Focus ${way}`, run: () => layout?.move(way) },
      { chord: `Meta+${arrow}`, group: "Focus", label: `Focus ${way}`, run: () => layout?.move(way) },
    ]),
    { chord: "Meta+Home", group: "Focus", label: "Focus the first column", run: () => layout?.moveToEdge("first") },
    { chord: "Meta+End", group: "Focus", label: "Focus the last column", run: () => layout?.moveToEdge("last") },
    { chord: "Meta+o", group: "Focus", label: "Overview", run: () => layout?.toggleOverview() },
    { chord: "Meta+Ctrl+h", group: "Move", label: "Move the column left", run: () => layout?.moveColumn("left") },
    { chord: "Meta+Ctrl+l", group: "Move", label: "Move the column right", run: () => layout?.moveColumn("right") },
    {
      chord: "Meta+Ctrl+j",
      group: "Move",
      label: "Move the window down, or to the workspace below",
      run: () => layout?.moveWindowOrToWorkspace("down"),
    },
    {
      chord: "Meta+Ctrl+k",
      group: "Move",
      label: "Move the window up, or to the workspace above",
      run: () => layout?.moveWindowOrToWorkspace("up"),
    },
    { chord: "Meta+Ctrl+Left", group: "Move", label: "Move the column left", run: () => layout?.moveColumn("left") },
    { chord: "Meta+Ctrl+Right", group: "Move", label: "Move the column right", run: () => layout?.moveColumn("right") },
    { chord: "Meta+Ctrl+Down", group: "Move", label: "Move the window down", run: () => layout?.moveWindow("down") },
    { chord: "Meta+Ctrl+Up", group: "Move", label: "Move the window up", run: () => layout?.moveWindow("up") },
    { chord: "Meta+Ctrl+Home", group: "Move", label: "Move the column first", run: () => layout?.moveColumn("first") },
    { chord: "Meta+Ctrl+End", group: "Move", label: "Move the column last", run: () => layout?.moveColumn("last") },
    { chord: "Meta+Shift+H", group: "Move", label: "Move the column left", run: () => layout?.moveColumn("left") },
    { chord: "Meta+Shift+L", group: "Move", label: "Move the column right", run: () => layout?.moveColumn("right") },
    { chord: "Meta+Shift+J", group: "Move", label: "Move the window down", run: () => layout?.moveWindow("down") },
    { chord: "Meta+Shift+K", group: "Move", label: "Move the window up", run: () => layout?.moveWindow("up") },
    { chord: "Meta+u", group: "Workspaces", label: "Workspace below", run: () => layout?.focusWorkspace("down") },
    { chord: "Meta+i", group: "Workspaces", label: "Workspace above", run: () => layout?.focusWorkspace("up") },
    {
      chord: "Alt+Tab",
      group: "Workspaces",
      label: "The workspace before",
      run: () => layout?.focusWorkspace("previous"),
    },
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((number): Binding[] => [
      {
        chord: `Meta+${number}`,
        group: "Workspaces",
        label: `Workspace ${number}`,
        run: () => layout?.focusWorkspace(number),
      },
      {
        chord: `Meta+Ctrl+${number}`,
        group: "Workspaces",
        label: `Move the window to workspace ${number}`,
        run: () => layout?.moveToWorkspace(number),
      },
    ]),
    { chord: "Meta+space", group: "Desktop", label: "Next keyboard layout", run: () => keymap?.next() },
    { chord: "Meta+Shift+space", group: "Desktop", label: "These keybindings", run: () => toggleExplorer() },
    // swaylock's key under niri.
    { chord: "Ctrl+Alt+Delete", group: "Desktop", label: "Lock", run: () => domicile.session.lock() },
    {
      chord: "Meta+Shift+P",
      group: "Desktop",
      label: "Turn the monitors off",
      run: () => logged("turning the monitors off", domicile.displays.sleep()),
    },
    {
      chord: "Print",
      group: "Desktop",
      label: "Screenshot",
      run: () => logged("screenshot", domicile.capture.screenshot()),
    },
    {
      chord: "Shift+Print",
      group: "Desktop",
      label: "Record the screen",
      run: () => logged("recording", domicile.capture.screenRecord()),
    },
    // croshome installs `domicile-quit`: SIGTERM to the launcher.
    { chord: "Meta+Shift+E", group: "Desktop", label: "Quit the desktop", run: launch(["domicile-quit"]) },
  ];
  const bindings: Readonly<Record<string, () => void>> = Object.fromEntries(keys.map(({ chord, run }) => [chord, run]));

  // The keybinding explorer. While it is open, a grabbed chord is shown in it
  // rather than run, except its own, which closes it.
  let explorer = $state<ReturnType<typeof Explorer>>();
  let isExplorerOpen = $state(false);
  const toggleExplorer = () => {
    isExplorerOpen = !isExplorerOpen;
    if (!isExplorerOpen) {
      layout?.refocus();
    }
  };
  const closeExplorer = () => {
    if (isExplorerOpen) {
      isExplorerOpen = false;
      layout?.refocus();
    }
  };
  const pressed = (chord: string) => {
    if (isExplorerOpen && chord !== "Meta+Shift+space") {
      explorer?.heard(chord);
    } else {
      bindings[chord]?.();
    }
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
    const unlisten = domicile.keyboard.on("shortcut", ({ chord }) => pressed(chord));
    return () => {
      unlisten();
      for (const chord of Object.keys(bindings)) {
        domicile.keyboard.ungrab(chord);
      }
    };
  });

  // niri's: the view and the windows move with the fingers.
  const swiped = ({ fingers, direction }: Swipe) => {
    if (fingers === 4) {
      if (layout !== undefined && (direction === "up" || direction === "down")) {
        layout.setOverview(direction === "up");
      }
    } else if (direction === "up" || direction === "down") {
      layout?.focusWorkspace(direction === "up" ? "down" : "up");
    } else {
      layout?.move(direction === "left" ? "right" : "left");
    }
  };
  $effect(() => {
    const grabbed = ["swipe:3", "swipe:4"];
    for (const gesture of grabbed) {
      domicile.gestures.grab(gesture);
    }
    const unlisten = domicile.gestures.on("gesture", swipes(swiped));
    return () => {
      unlisten();
      for (const gesture of grabbed) {
        domicile.gestures.ungrab(gesture);
      }
    };
  });

  // How long tiles take to ease into a new box; `settle-ms` slows it down to
  // watch it.
  let settle = $state(220);
  // `let-go-ms`, as `settle-ms`.
  let letGoAfter = $state(5 * 60_000);

  // `domicile send-shell <command>...`: the layout actions by name, as niri
  // msg has them, for scripts and for testing without the keyboard.
  type Command = {
    usage: string;
    description: string;
    run: (args: readonly string[]) => Result<CommandRan, string>;
  };
  const ran = (action: () => void): Result<CommandRan, string> => {
    action();
    return Ok("ran");
  };
  const workspace = (word: string | undefined): number | "up" | "down" | undefined =>
    word === "up" || word === "down" ? word : Number(word) >= 1 ? Number(word) : undefined;
  const commands: Record<string, Command> = {
    workspace: {
      usage: "workspace <number>|up|down|previous",
      description: "Show a workspace.",
      run: ([word]) => {
        const target = word === "previous" ? word : workspace(word);
        return target === undefined
          ? Err("workspace takes a number, up, down or previous")
          : ran(() => layout?.focusWorkspace(target));
      },
    },
    "move-to-workspace": {
      usage: "move-to-workspace <number>|up|down",
      description: "Move the active column to a workspace.",
      run: ([word]) => {
        const target = workspace(word);
        return target === undefined
          ? Err("move-to-workspace takes a number, up or down")
          : ran(() => layout?.moveToWorkspace(target));
      },
    },
    focus: {
      usage: "focus left|right|up|down",
      description: "Focus the neighbor of the active window.",
      run: ([direction]) =>
        direction === "left" || direction === "right" || direction === "up" || direction === "down"
          ? ran(() => layout?.move(direction))
          : Err("focus takes left, right, up or down"),
    },
    maximize: {
      usage: "maximize",
      description: "Maximize the active column, or give it back its width.",
      run: () => ran(() => layout?.maximize()),
    },
    fullscreen: {
      usage: "fullscreen",
      description: "Fill the screen with the active window, or put it back.",
      run: () => ran(() => layout?.toggleFullscreen()),
    },
    "cycle-width": {
      usage: "cycle-width",
      description: "Step the active column through the preset widths.",
      run: () => ran(() => layout?.cycleWidth()),
    },
    center: {
      usage: "center",
      description: "Scroll the active column to the middle of the view.",
      run: () => ran(() => layout?.center()),
    },
    consume: {
      usage: "consume",
      description: "Take the next column's top window into the active column.",
      run: () => ran(() => layout?.consume()),
    },
    expel: {
      usage: "expel",
      description: "Move the active window to a column of its own.",
      run: () => ran(() => layout?.expel()),
    },
    "consume-or-expel": {
      usage: "consume-or-expel left|right",
      description: "niri's consume-or-expel-window-left and -right.",
      run: ([side]) =>
        side === "left" || side === "right"
          ? ran(() => layout?.consumeOrExpel(side))
          : Err("consume-or-expel takes left or right"),
    },
    overview: {
      usage: "overview",
      description: "Open the overview of every window, or close it on the active one.",
      run: () => ran(() => layout?.toggleOverview()),
    },
    park: {
      usage: "park",
      description: "Take the active window off the strip.",
      run: () => ran(() => layout?.park()),
    },
    close: {
      usage: "close",
      description: "Ask the active window to close.",
      run: () => ran(() => layout?.close()),
    },
    unload: {
      usage: "unload",
      description: "Park the active page, and free its memory until it is shown.",
      run: () => ran(() => layout?.unload()),
    },
    notifications: {
      usage: "notifications",
      description: "Open the notification history, or close it.",
      run: () => ran(() => notifications?.toggle()),
    },
    cast: {
      usage: "cast",
      description: "Open the panel that casts to TVs, or close it.",
      run: () => ran(() => cast?.toggle()),
    },
    downloads: {
      usage: "downloads",
      description: "Open the list of downloads, or close it.",
      run: () => ran(() => downloads?.toggle()),
    },
    "night-light": {
      usage: "night-light",
      description: "Turn the night light on or off.",
      run: () => ran(() => nightLight?.toggle()),
    },
    monitor: {
      usage: "monitor",
      description: "Open the system monitor, or close it.",
      run: () => ran(() => monitor?.toggle()),
    },
    "let-go-ms": {
      usage: "let-go-ms <ms>",
      description: "Set how long a page is out of view before it may be unloaded.",
      run: ([ms]) => {
        const value = Number(ms);
        return Number.isFinite(value) && value >= 0
          ? ran(() => (letGoAfter = value))
          : Err("let-go-ms takes a number of milliseconds");
      },
    },
    "settle-ms": {
      usage: "settle-ms <ms>",
      description: "Set how long tiles take to ease into a new box.",
      run: ([ms]) => {
        const value = Number(ms);
        return Number.isFinite(value) && value >= 0
          ? ran(() => (settle = value))
          : Err("settle-ms takes a number of milliseconds");
      },
    },
  };

  const runCommand = ([name, ...args]: readonly string[]): Result<CommandRan, string> => {
    const command = name === undefined ? undefined : commands[name];
    return command === undefined ? Err(`unknown command: ${name ?? ""}`) : command.run(args);
  };

  $effect(() => {
    let stop = () => {};
    const hear = async (items: ReadableStream<ShellCommand>) => {
      const reader = items.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          return;
        }
        domicile.shell
          .answer(value.sent, runCommand(value.words))
          .then((answered) =>
            answered.match({ Ok: () => undefined, Err: (error) => console.error("[shell] answer", error) }),
          )
          .catch((error: unknown) => console.error("[shell] answer", error));
      }
    };
    const help = Object.values(commands).map(({ usage, description }) => ({ usage, description }));
    domicile.shell
      .commands(help, [])
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
<div class="desktop" style:background-image={background.url === undefined ? undefined : `url("${background.url}")`}>
  <Bar>
    {#snippet left()}
      <Idle onclicked={() => layout?.refocus()} />
      <Workspaces workspaces={layout?.listWorkspaces() ?? []} onpick={(number) => layout?.focusWorkspace(number)} />
      <Keymap bind:this={keymap} onclicked={() => layout?.refocus()} />
    {/snippet}
    {#snippet center()}
      {#if pageBar.controls === undefined}<WindowTitle />{:else}{@render pageBar.controls()}{/if}
    {/snippet}
    {#snippet right()}
      <Capturing />
      <Monitor bind:this={monitor} onclose={() => layout?.refocus()} />
      <Volume />
      <NightLight bind:this={nightLight} onclicked={() => layout?.refocus()} />
      <Downloads bind:this={downloads} onclose={() => layout?.refocus()} />
      <Extensions onclose={() => layout?.refocus()} />
      <Tray icon={apps.icon} onclose={() => layout?.refocus()} />
      <Cast bind:this={cast} oncasting={(casting) => (isCasting = casting)} onclose={() => layout?.refocus()} />
      <Notifications bind:this={notifications} quiet={isCasting} onclose={() => layout?.refocus()} />
      <Clock />
    {/snippet}
  </Bar>
  <Scrolling bind:this={layout} {settle} {letGoAfter} />
  <PictureInPicture onclose={() => layout?.refocus()} />
  {#if isLauncherOpen}
    <!-- Opened again, it starts from an empty query. -->
    {#key launcher}
      <Launcher sources={launcher.sources} placeholder={launcher.placeholder} onclose={closeLauncher} />
    {/key}
  {/if}
  {#if isExplorerOpen}
    <Explorer bind:this={explorer} bindings={keys} onclose={closeExplorer} />
  {/if}
</div>
<Portals onclose={() => layout?.refocus()} icon={apps.appIcon} chords={Object.keys(bindings)} />
<Lock background={lockPicture.url ?? lockscreen} onunlock={() => layout?.refocus()} />

<style>
  :global(:root) {
    scrollbar-color: #45475a transparent;
  }

  /* Not inherited, unlike the color. */
  :global(*) {
    scrollbar-width: thin;
  }

  .desktop {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 0 8px;
    box-sizing: border-box;
    background: #1e1e2e center / cover no-repeat;
    /* A double click on an <app> selects the next <webview>, and paints it blue. */
    user-select: none;
  }
</style>
