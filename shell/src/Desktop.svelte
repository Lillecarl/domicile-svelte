<script lang="ts">
  import { Err, Ok, type Result } from "@cprussin/option-result";
  import type { CommandRan, ShellCommand } from "@domicile-desktop/sdk/shell-command";
  import { type SystemError, SystemErrorKind } from "@domicile-desktop/sdk/system";
  import { Bar } from "@domicile-svelte/bar";
  import Cast from "@domicile-svelte/bar-cast";
  import Clock from "@domicile-svelte/bar-clock";
  import Downloads from "@domicile-svelte/bar-downloads";
  import Extensions from "@domicile-svelte/bar-extensions";
  import Keymap from "@domicile-svelte/bar-keymap";
  import Monitor from "@domicile-svelte/bar-monitor";
  import Notifications from "@domicile-svelte/bar-notifications";
  import Tray from "@domicile-svelte/bar-tray";
  import Volume from "@domicile-svelte/bar-volume";
  import WindowTitle from "@domicile-svelte/bar-window-title";
  import Workspaces from "@domicile-svelte/bar-workspaces";
  import { installedSource, Launcher, matching, type Source } from "@domicile-svelte/launcher";
  import { Lock } from "@domicile-svelte/lock";
  import { Capturing, picture, Portals } from "@domicile-svelte/portals";
  import { useDomicile, watch } from "@domicile-svelte/svelte";
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
    "Meta+v": () => openLauncher([copies], "History"),
    "Meta+space": () => keymap?.next(),
    "Meta+p": () => layout?.park(),
    "Meta+o": () => layout?.toggleOverview(),
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
    "Meta+Ctrl+j": () => layout?.moveWindowOrToWorkspace("down"),
    "Meta+Ctrl+k": () => layout?.moveWindowOrToWorkspace("up"),
    "Meta+Ctrl+Left": () => layout?.moveColumn("left"),
    "Meta+Ctrl+Right": () => layout?.moveColumn("right"),
    "Meta+Ctrl+Down": () => layout?.moveWindow("down"),
    "Meta+Ctrl+Up": () => layout?.moveWindow("up"),
    "Meta+Ctrl+Home": () => layout?.moveColumn("first"),
    "Meta+Ctrl+End": () => layout?.moveColumn("last"),
    "Meta+Shift+H": () => layout?.moveColumn("left"),
    "Meta+Shift+L": () => layout?.moveColumn("right"),
    "Meta+Shift+J": () => layout?.moveWindow("down"),
    "Meta+Shift+K": () => layout?.moveWindow("up"),
    "Meta+u": () => layout?.focusWorkspace("down"),
    "Meta+i": () => layout?.focusWorkspace("up"),
    "Alt+Tab": () => layout?.focusWorkspace("previous"),
    ...Object.fromEntries(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((number) => [
        [`Meta+${number}`, () => layout?.focusWorkspace(number)],
        [`Meta+Ctrl+${number}`, () => layout?.moveToWorkspace(number)],
      ]),
    ),
    "Meta+comma": () => layout?.consume(),
    "Meta+period": () => layout?.expel(),
    "Meta+bracketleft": () => layout?.consumeOrExpel("left"),
    "Meta+bracketright": () => layout?.consumeOrExpel("right"),
    "Meta+r": () => layout?.cycleWidth(),
    "Meta+f": () => layout?.maximize(),
    "Meta+Shift+F": () => layout?.toggleFullscreen(),
    "Meta+c": () => layout?.center(),
    Print: () => logged("screenshot", domicile.capture.screenshot()),
    "Shift+Print": () => logged("recording", domicile.capture.screenRecord()),
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
      <Workspaces workspaces={layout?.listWorkspaces() ?? []} onpick={(number) => layout?.focusWorkspace(number)} />
      <Keymap bind:this={keymap} onclicked={() => layout?.refocus()} />
    {/snippet}
    {#snippet center()}<WindowTitle />{/snippet}
    {#snippet right()}
      <Capturing />
      <Monitor bind:this={monitor} onclose={() => layout?.refocus()} />
      <Volume />
      <Downloads bind:this={downloads} onclose={() => layout?.refocus()} />
      <Extensions onclose={() => layout?.refocus()} />
      <Tray icon={apps.icon} onclose={() => layout?.refocus()} />
      <Cast bind:this={cast} oncasting={(casting) => (isCasting = casting)} onclose={() => layout?.refocus()} />
      <Notifications bind:this={notifications} quiet={isCasting} onclose={() => layout?.refocus()} />
      <Clock />
    {/snippet}
  </Bar>
  <Scrolling bind:this={layout} {settle} {letGoAfter} />
  {#if isLauncherOpen}
    <!-- Opened again, it starts from an empty query. -->
    {#key launcher}
      <Launcher sources={launcher.sources} placeholder={launcher.placeholder} onclose={closeLauncher} />
    {/key}
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
  }
</style>
