<!--
  A browser window: an address bar over the page. An extension's popup window
  and a site's app window get no address bar, as in Chrome.
-->
<script lang="ts">
  import { acceleratedBy, appMenu, appPopupMenu, openedByMnemonic } from "@domicile-desktop/sdk/app-menu";
  import type { BrowserWindow } from "@domicile-desktop/sdk/desktop/browser";
  import { messageBox } from "@domicile-desktop/sdk/message-box";
  import {
    WEBVIEW_CONTEXT_MENU_EVENT,
    WEBVIEW_DEVICE_REQUEST_CHANGE_EVENT,
    WEBVIEW_DEVICE_REQUEST_EVENT,
    WEBVIEW_DEVICE_REQUEST_WITHDRAWN_EVENT,
    WEBVIEW_DIALOG_EVENT,
    WEBVIEW_DIALOG_WITHDRAWN_EVENT,
    WEBVIEW_EXTERNAL_APP_EVENT,
    WEBVIEW_EXTERNAL_APP_WITHDRAWN_EVENT,
    WEBVIEW_FAVICON_CHANGE_EVENT,
    WEBVIEW_FILE_CHOOSER_EVENT,
    WEBVIEW_FOCUS_REQUEST_EVENT,
    WEBVIEW_GUEST_FOCUS_EVENT,
    WEBVIEW_GUEST_KEYDOWN_EVENT,
    WEBVIEW_GUEST_KEYUP_EVENT,
    WEBVIEW_IDENTITY_EVENT,
    WEBVIEW_IDENTITY_WITHDRAWN_EVENT,
    WEBVIEW_LOAD_PROGRESS_CHANGE_EVENT,
    WEBVIEW_LOADING_CHANGE_EVENT,
    WEBVIEW_PAGE_CHANGE_EVENT,
    WEBVIEW_PAGE_FAILURE_CHANGE_EVENT,
    WEBVIEW_PAGE_FULLSCREEN_CHANGE_EVENT,
    WEBVIEW_PERMISSION_REQUEST_EVENT,
    WEBVIEW_PERMISSION_REQUEST_WITHDRAWN_EVENT,
    WEBVIEW_PICKER_EVENT,
    WEBVIEW_PICKER_WITHDRAWN_EVENT,
    WEBVIEW_PROMPT_EVENT,
    WEBVIEW_PROMPT_WITHDRAWN_EVENT,
    WEBVIEW_RENDER_PROCESS_CHANGE_EVENT,
    WEBVIEW_SIGN_IN_EVENT,
    WEBVIEW_SIGN_IN_WITHDRAWN_EVENT,
    WEBVIEW_ZOOM_CHANGE_EVENT,
    WEBVIEW_ZOOM_IN_REQUEST_EVENT,
    WEBVIEW_ZOOM_OUT_REQUEST_EVENT,
  } from "@domicile-desktop/sdk/webview-element";
  import { commandFor, extensionItemsOf, runsCommands } from "@domicile-svelte/extensions";
  import type { Entry } from "@domicile-svelte/menu";
  import { useDomicile, watch } from "@domicile-svelte/svelte";
  import { tick, untrack } from "svelte";

  import AppMenuBar from "./AppMenuBar.svelte";
  import { addressOf } from "./address";
  import { appEntries, boxAsk } from "./app-menu";
  import { type Ask, dialogAsk } from "./ask";
  import { deviceAsk } from "./device";
  import { appIn, externalAppAsk } from "./external-app";
  import Find from "./Find.svelte";
  import PageAsk from "./PageAsk.svelte";
  import PageButtons from "./PageButtons.svelte";
  import PageHints from "./PageHints.svelte";
  import PagePicker from "./PagePicker.svelte";
  import PageProblem from "./PageProblem.svelte";
  import { pageMenu } from "./page-menu";
  import PageView from "./PageView.svelte";
  import Permission, { type Request } from "./Permission.svelte";
  import { asksTo, permissionMenu } from "./permissions";
  import { type Problem, problemOf } from "./problem";
  import { promptAsk } from "./prompt";
  import { identityAsk, signInAsk } from "./sign-in";
  import { zoomedIn, zoomedOut } from "./zoom";

  const {
    window: browserWindow,
    onfocus,
    onfocusrequest,
    onmenu,
    onfiles,
    onunload,
    onfullscreen,
    fullscreen,
    active,
    drawn,
  }: {
    /** The page or the user asks for fullscreen, or out of it. */
    onfullscreen: (on: boolean) => void;
    /** Whether the window has the keyboard, or had it last. */
    active: boolean;
    /** Whether the window fills the screen. */
    fullscreen: boolean;
    /** The page asks for files, or where to save one: draw a picker and answer it. */
    onfiles: (request: DomicileFileChooserEvent) => void;
    /** Whether to show the page. It runs on while it is not shown, until the engine unloads it. */
    drawn: boolean;
    /** Unload was chosen: hide the page and free its memory. None, and it is not offered. */
    onunload: (() => void) | undefined;
    window: BrowserWindow;
    /** The page or the address bar took focus. */
    onfocus: () => void;
    /** The page or an extension asked to be raised. */
    onfocusrequest: () => void;
    /** Draw this menu there, on the screen. The answer puts it away. */
    onmenu: (entries: Entry[], x: number, y: number, onclose?: () => void) => () => void;
  } = $props();

  const { browser, extensions, processes } = useDomicile();

  type Page = HTMLWebViewElement;
  /** What an ask is answered to: one of the window's pages, through the event it asked with, or its app. */
  type Asker = { readonly target: EventTarget | null };

  let frame = $state<HTMLElement>();
  let address = $state<HTMLInputElement>();
  let page = $state<Page>();
  let typed = $state("");
  let request = $state.raw<Request>();
  // What the page asks, oldest first; the engine sends one of a kind at a time.
  let asking = $state.raw<readonly { kind: string; event: Asker; ask: Ask }[]>([]);
  let finding = $state(false);
  let zoom = $state(1);
  let loading = $state(false);
  let loaded = $state(0);
  let favicon = $state("");
  let problem = $state.raw<Problem>();
  let problemBox = $state<ReturnType<typeof PageProblem> | null>();
  let finder = $state<ReturnType<typeof Find> | null>();
  let picking = $state.raw<DomicilePickerEvent>();
  let picker = $state<ReturnType<typeof PagePicker> | null>();
  let shown = $state<ReturnType<typeof PageAsk>>();
  // The SDK hands the engine's null as undefined. A site opened as an app
  // (`domicile open --app`) is drawn as an application, without one too.
  const chrome = $derived(!fullscreen && browserWindow.popupWindow === undefined && !browserWindow.isApp);

  // The page that had the keyboard: the window's, or a view of its app's.
  let last: EventTarget | null = null;

  // What an Electron app says of its window.
  const allViews = watch(browser, "change", () => browser.views);
  const views = $derived((allViews.current ?? []).filter(({ parent }) => parent === id));
  const read = <Value,>(text: string | undefined, parse: (text: string) => Value): Value | undefined => {
    try {
      return text === undefined ? undefined : parse(text);
    } catch (error) {
      console.error("[windows] app", error);
      return undefined;
    }
  };
  const menuText = $derived(browserWindow.menu);
  const menu = $derived(read(menuText, appMenu) ?? []);
  let altAlone = false;
  // A bar that hides itself, shown by Alt.
  let barShown = $state(false);
  let bar = $state<ReturnType<typeof AppMenuBar> | null>();
  const hasBar = $derived(!fullscreen && menu.length > 0 && browserWindow.menuBarVisible);
  const showsBar = $derived(hasBar && (!browserWindow.menuBarAutoHide || barShown));
  const chooseMenu = (entry: number) => browser.clickMenu(id, entry);
  // Whether `event` is the app's: an accelerator, or Alt and a menu's letter.
  const menuKey = (event: KeyboardEvent) => {
    const accelerated = acceleratedBy(menu, event);
    const opened = hasBar ? openedByMnemonic(menu, event) : undefined;
    if (accelerated !== undefined) {
      chooseMenu(accelerated.id);
    } else if (opened !== undefined) {
      barShown = true;
      void tick().then(() => bar?.open(opened.id));
    }
    return accelerated !== undefined || opened !== undefined;
  };

  const boxText = $derived(browserWindow.messageBox);
  $effect(() => {
    const box = read(boxText, messageBox);
    const window = id;
    if (box === undefined || page === undefined) {
      return undefined;
    }
    const asker = { target: null };
    untrack(() =>
      asks(
        "app",
        asker,
        boxAsk(box, (button, ticked) => browser.answerMessageBox(window, button, ticked)),
      ),
    );
    return () => untrack(() => asksNo("app", asker));
  });

  const popupText = $derived(browserWindow.popupMenu);
  $effect(() => {
    const text = popupText;
    const window = id;
    if (text === undefined || page === undefined) {
      return undefined;
    }
    const box = page.getBoundingClientRect();
    return untrack(() => {
      const popup = read(text, appPopupMenu);
      let chosen = 0;
      let answered = false;
      const answer = () => {
        if (!answered) {
          answered = true;
          browser.answerPopupMenu(window, chosen);
        }
      };
      if (popup === undefined) {
        answer();
        return undefined;
      }
      const entries = appEntries(popup.entries, (entry) => (chosen = entry));
      const close = onmenu(entries, box.left + popup.at.x, box.top + popup.at.y, answer);
      return () => {
        // The app took it back, or has another: no answer.
        answered = true;
        close();
      };
    });
  });

  // The list hands a new object on every change; the view follows the id.
  const id = $derived(browserWindow.id);

  // Ask `ask`, in the place of any other of its kind and page.
  const asks = (kind: string, event: Asker, ask: Ask) => {
    const next = { kind, event, ask };
    asking = asking.some((each) => each.event === event)
      ? asking.map((each) => (each.event === event ? next : each))
      : [...asking.filter((each) => each.kind !== kind || each.event.target !== event.target), next];
  };
  const asksNo = (kind: string, { target }: Asker) => {
    const had = hasKeyboard();
    asking = asking.filter((each) => each.kind !== kind || each.event.target !== target);
    regain(had);
  };
  const hasKeyboard = () => frame?.contains(document.activeElement) === true;
  // The keyboard back to the page, if what asked had it.
  const regain = (had: boolean) => {
    if (active && had) {
      void tick().then(focus);
    }
  };
  const picked = (answer: () => void) => {
    const had = hasKeyboard();
    try {
      answer();
    } catch (error) {
      console.error("[windows] picker", error);
    }
    picking = undefined;
    regain(had);
  };
  const answered = (event: Asker, answer: () => void) => {
    const had = hasKeyboard();
    // Still asked while it is answered: the answer reads it.
    try {
      answer();
    } catch (error) {
      // Its page went meanwhile.
      console.error("[windows] answer", error);
    }
    asking = asking.filter((each) => each.event !== event);
    regain(had);
  };

  const mountView = (frame: HTMLElement, id: string) => {
    // The engine reads `window` once, when the view connects, and a window
    // shows in one view at a time: create it here, once, attribute first.
    const view = document.createElement("webview") as Page;
    view.setAttribute("window", id);
    // An app's views are in the frame too, and its events bubble.
    const stop = new AbortController();
    type Heard<Name> = Name extends keyof HTMLElementEventMap ? HTMLElementEventMap[Name] : Event;
    const hears = <Name extends string>(name: Name, heard: (event: Heard<Name>) => void) =>
      frame.addEventListener(name, heard as (event: Event) => void, { signal: stop.signal });
    let shown = "";
    const changed = () => {
      // A window opened at a URL is blank at first, so its bar took the focus.
      const loaded = blank(shown) && !blank(view.url) && typed === shown;
      const editing = document.activeElement === address;
      if (!editing || loaded) {
        typed = view.url;
      }
      if (editing && loaded) {
        view.focus();
      }
      shown = view.url;
    };
    view.addEventListener(WEBVIEW_PAGE_CHANGE_EVENT, changed);
    const readProblem = () => {
      const had = hasKeyboard();
      const was = problem;
      problem = problemOf(view);
      if (problem !== was) {
        regain(had);
      }
    };
    readProblem();
    view.addEventListener(WEBVIEW_PAGE_FAILURE_CHANGE_EVENT, readProblem);
    view.addEventListener(WEBVIEW_RENDER_PROCESS_CHANGE_EVENT, readProblem);
    const readLoading = () => {
      loading = view.loading;
      loaded = view.loadProgress;
    };
    readLoading();
    view.addEventListener(WEBVIEW_LOADING_CHANGE_EVENT, readLoading);
    view.addEventListener(WEBVIEW_LOAD_PROGRESS_CHANGE_EVENT, readLoading);
    const readFavicon = () => {
      favicon = view.favicon;
    };
    readFavicon();
    view.addEventListener(WEBVIEW_FAVICON_CHANGE_EVENT, readFavicon);
    const readZoom = () => (zoom = view.zoom);
    readZoom();
    view.addEventListener(WEBVIEW_ZOOM_CHANGE_EVENT, readZoom);
    view.addEventListener(WEBVIEW_ZOOM_IN_REQUEST_EVENT, zoomIn);
    view.addEventListener(WEBVIEW_ZOOM_OUT_REQUEST_EVENT, zoomOut);
    hears(WEBVIEW_GUEST_FOCUS_EVENT, (event) => {
      last = event.target;
      onfocus();
    });
    view.addEventListener(WEBVIEW_PAGE_FULLSCREEN_CHANGE_EVENT, () => onfullscreen(view.pageFullscreen));
    hears(WEBVIEW_FOCUS_REQUEST_EVENT, (event) => {
      last = event.target;
      onfocusrequest();
    });
    // The page saw the chord first and let it through.
    hears(WEBVIEW_GUEST_KEYDOWN_EVENT, (event) => {
      altAlone = event.key === "Alt" && (altAlone || !event.repeat);
      if (menuKey(event)) {
        event.preventDefault();
        return;
      }
      const binding = event.target === view ? bindings[chordOf(event)] : undefined;
      const extension = binding === undefined && runsCommands(extensions) ? commandFor(extensions, event) : undefined;
      if (binding !== undefined) {
        event.preventDefault();
        binding();
      } else if (extension !== undefined) {
        event.preventDefault();
        extensions.runCommand(extension.id, extension.command.name);
      }
    });
    hears(WEBVIEW_GUEST_KEYUP_EVENT, (event) => {
      if (event.key === "Alt" && altAlone) {
        altAlone = false;
        barShown = !barShown;
      }
    });
    view.addEventListener(WEBVIEW_CONTEXT_MENU_EVENT, (event) => {
      const box = view.getBoundingClientRect();
      const entries = pageMenu(
        event,
        {
          canGoBack: view.canGoBack,
          canGoForward: view.canGoForward,
          back: () => view.goBack(),
          forward: () => view.goForward(),
          reload: () => view.reload(),
          open: (url) => browser.open(url),
        },
        extensionItemsOf(event),
        [
          ...permissionsOf(view),
          ...(onunload === undefined
            ? []
            : [{ kind: "item" as const, key: "unload", label: "Unload", enabled: true, run: onunload }]),
        ],
      );
      onmenu(entries, box.left + event.x, box.top + event.y);
    });
    // Uploads and downloads. Unclaimed, it is canceled.
    hears(WEBVIEW_FILE_CHOOSER_EVENT, (event) => {
      event.preventDefault();
      onfiles(event);
    });
    // Unclaimed, the engine answers no.
    hears(WEBVIEW_DIALOG_EVENT, (event) => {
      const ask = dialogAsk(event);
      if (ask !== undefined) {
        event.preventDefault();
        asks("dialog", event, ask);
      }
    });
    hears(WEBVIEW_DIALOG_WITHDRAWN_EVENT, (event) => asksNo("dialog", event));
    hears(WEBVIEW_PICKER_EVENT, (event) => {
      event.preventDefault();
      picking = event;
    });
    hears(WEBVIEW_PICKER_WITHDRAWN_EVENT, (event) => {
      if (picking?.target === event.target) {
        picked(() => undefined);
      }
    });
    hears(WEBVIEW_SIGN_IN_EVENT, (event) => {
      event.preventDefault();
      asks("sign-in", event, signInAsk(event));
    });
    hears(WEBVIEW_SIGN_IN_WITHDRAWN_EVENT, (event) => asksNo("sign-in", event));
    hears(WEBVIEW_IDENTITY_EVENT, (event) => {
      event.preventDefault();
      asks("identity", event, identityAsk(event));
    });
    hears(WEBVIEW_IDENTITY_WITHDRAWN_EVENT, (event) => asksNo("identity", event));
    hears(WEBVIEW_PROMPT_EVENT, (event) => {
      const ask = promptAsk(event);
      if (ask !== undefined) {
        event.preventDefault();
        asks("prompt", event, ask);
      }
    });
    hears(WEBVIEW_PROMPT_WITHDRAWN_EVENT, (event) => asksNo("prompt", event));
    let link: Event | undefined;
    hears(WEBVIEW_EXTERNAL_APP_EVENT, (event) => {
      event.preventDefault();
      link = event;
      processes
        .run(["domicile", "open", "--which", event.url])
        .then((ran) =>
          ran.match({
            Ok: appIn,
            Err: (error) => {
              console.error("[windows] what opens", event.url, error);
              return undefined;
            },
          }),
        )
        .then((app) => {
          if (link === event) {
            asks("external-app", event, externalAppAsk(event, app));
          }
        })
        .catch((error: unknown) => console.error("[windows] what opens", event.url, error));
    });
    hears(WEBVIEW_EXTERNAL_APP_WITHDRAWN_EVENT, (event) => {
      if (link?.target === event.target) {
        link = undefined;
      }
      asksNo("external-app", event);
    });
    let devices: DomicileDeviceRequestEvent | undefined;
    hears(WEBVIEW_DEVICE_REQUEST_EVENT, (event) => {
      event.preventDefault();
      devices = event;
      asks("device", event, deviceAsk(event));
    });
    hears(WEBVIEW_DEVICE_REQUEST_CHANGE_EVENT, () => {
      const event = devices;
      if (event !== undefined && asking.some((each) => each.event === event)) {
        asks("device", event, deviceAsk(event));
      }
    });
    hears(WEBVIEW_DEVICE_REQUEST_WITHDRAWN_EVENT, (event) => asksNo("device", event));
    // The browser sends one at a time. Unclaimed, the page gets nothing.
    hears(WEBVIEW_PERMISSION_REQUEST_EVENT, (event) => {
      const asks = asksTo(event.permissions);
      if (asks === undefined) {
        return;
      }
      event.preventDefault();
      const answering = (answer: () => void) => () => {
        request = undefined;
        answer();
        focus();
      };
      request = {
        site: event.origin.replace(/^https:\/\//u, ""),
        asks,
        allow: answering(() => event.allow()),
        deny: answering(() => event.deny()),
        dismiss: answering(() => event.dismiss()),
      };
    });
    hears(WEBVIEW_PERMISSION_REQUEST_WITHDRAWN_EVENT, () => {
      request = undefined;
    });
    frame.append(view);
    page = view;
    changed();
    return () => {
      stop.abort();
      view.remove();
      page = undefined;
      // A view hears of no more; the browser asks the next one again.
      request = undefined;
      asking = [];
      picking = undefined;
      finding = false;
      problem = undefined;
    };
  };

  // Untracked past `frame` and `id`: anything else read here would remake the
  // view, and the page with it.
  $effect(() => {
    if (frame !== undefined && drawn) {
      const target = frame;
      const window = id;
      return untrack(() => mountView(target, window));
    }
  });

  // A page asks for fullscreen before its window has it: only the window
  // leaving takes the page out.
  let wasFullscreen = false;
  $effect(() => {
    if (wasFullscreen && !fullscreen && page?.pageFullscreen === true) {
      page.exitPageFullscreen();
    }
    wasFullscreen = fullscreen;
  });

  const blank = (url: string) => url === "" || url === "about:blank";

  /** Focus the page, or the address bar while the page is blank. */
  export const focus = () => {
    if (shown !== undefined && shown !== null && asking[0]?.ask.aside !== true) {
      shown.focus();
    } else if (picking !== undefined) {
      picker?.focus();
    } else if (problem !== undefined) {
      problemBox?.focus();
    } else if (chrome && blank(page?.url ?? "")) {
      address?.focus();
      address?.select();
    } else {
      pageFocused()?.focus();
    }
  };
  const pageFocused = () => (last instanceof HTMLElement && frame?.contains(last) === true ? last : page);

  const editAddress = () => {
    if (chrome) {
      address?.focus();
      address?.select();
    }
  };

  const zoomIn = () => page?.setZoom(zoomedIn(page.zoom));
  const zoomOut = () => page?.setZoom(zoomedOut(page.zoom));
  const unzoom = () => page?.setZoom(1);

  // The guest has none of Chrome's own keys.
  const bindings: Record<string, () => void> = {
    "Ctrl+l": editAddress,
    "Ctrl+f": () => {
      finding = true;
      finder?.focus();
    },
    // The key plus is on, with Shift or without.
    "Ctrl++": zoomIn,
    "Ctrl+=": zoomIn,
    "Ctrl+Shift++": zoomIn,
    "Ctrl+-": zoomOut,
    "Ctrl+0": unzoom,
    "Ctrl+r": () => page?.reload(),
    F11: () => onfullscreen(!fullscreen),
    "Alt+ArrowLeft": () => page?.goBack(),
    "Alt+ArrowRight": () => page?.goForward(),
  };

  const chordOf = (event: KeyboardEvent) =>
    [event.ctrlKey && "Ctrl", event.altKey && "Alt", event.shiftKey && "Shift", event.key].filter(Boolean).join("+");

  const addressKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      typed = page?.url ?? "";
      page?.focus();
    } else if (chordOf(event) === "Ctrl+l") {
      event.preventDefault();
      address?.select();
    }
  };

  // The page's keys, while what the shell draws over it has the keyboard.
  const keydown = (event: KeyboardEvent) => {
    const binding = event.defaultPrevented ? undefined : bindings[chordOf(event)];
    if (binding !== undefined) {
      event.preventDefault();
      binding();
    }
  };

  const permissionsOf = (view: Page) =>
    permissionMenu(view.sitePermissions(), (permission, setting) => view.setSitePermission(permission, setting));

  const showPermissions = (event: MouseEvent & { currentTarget: HTMLElement }) => {
    const [menu] = page === undefined ? [] : permissionsOf(page);
    if (menu?.kind === "item" && menu.submenu !== undefined) {
      const box = event.currentTarget.getBoundingClientRect();
      onmenu([...menu.submenu], box.left, box.bottom);
    }
  };

  const go = (text: string) => {
    const address = addressOf(text);
    if (page === undefined || address === undefined) {
      return;
    }
    page.src = address.url;
    page.focus();
  };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="browser" onfocusin={onfocus} onkeydown={keydown}>
  {#if chrome}
    <form
      onsubmit={(event) => {
        event.preventDefault();
        go(typed);
      }}
    >
      {#if page !== undefined}<PageButtons view={page} {loading} {onmenu} />{/if}
      <!-- A page may take the right click that opens this menu too. -->
      <button
        type="button"
        title="Site permissions"
        aria-label="Site permissions"
        onmousedown={(event) => event.preventDefault()}
        onclick={showPermissions}
      >
        {"\u{f033e}"}
      </button>
      {#if favicon !== ""}
        {#key favicon}
          <img
            src={favicon}
            alt=""
            onerror={(event) => event.currentTarget instanceof HTMLElement && (event.currentTarget.hidden = true)}
          />
        {/key}
      {/if}
      <input
        bind:this={address}
        bind:value={typed}
        onkeydown={addressKey}
        spellcheck="false"
        placeholder="Search or type a URL"
      />
      {#if Math.abs(zoom - 1) > 0.001}
        <button type="button" title="Reset the zoom" onmousedown={(event) => event.preventDefault()} onclick={unzoom}>
          {Math.round(zoom * 100)}%
        </button>
      {/if}
      {#if loading}<div class="progress" style:width="{loaded * 100}%"></div>{/if}
    </form>
  {/if}
  {#if showsBar}
    <AppMenuBar bind:this={bar} entries={menu} {onmenu} onchoose={chooseMenu} onclose={() => (barShown = false)} />
  {/if}
  <div class="page" bind:this={frame}>
    {#if drawn}
      {#each views as view (view.id)}<PageView {view} />{/each}
    {/if}
    {#if page !== undefined}<PageHints view={page} />{/if}
    {#if request !== undefined}<Permission {request} />{/if}
    {#if problem !== undefined && page !== undefined}
      <PageProblem bind:this={problemBox} {problem} view={page} />
    {/if}
    {#if finding && page !== undefined}
      <Find
        bind:this={finder}
        view={page}
        onclose={() => {
          finding = false;
          page?.focus();
        }}
      />
    {/if}
    {#if picking !== undefined}
      {@const event = picking}
      {#key event}
        <PagePicker
          bind:this={picker}
          request={event}
          {active}
          onchoose={(value) => picked(() => event.choose(value))}
          oncancel={() => picked(() => event.cancel())}
        />
      {/key}
    {/if}
    {#if asking[0] !== undefined}
      {@const { event, ask } = asking[0]}
      {#key event}
        <PageAsk
          bind:this={shown}
          {ask}
          {active}
          onlink={(url) => browser.open(url)}
          onanswered={(answer) => answered(event, answer)}
        />
      {/key}
    {/if}
  </div>
</div>

<style>
  .browser {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: #181825;
  }

  form {
    position: relative;
    display: flex;
    gap: 4px;
    padding: 4px;
  }

  button {
    padding: 0 8px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: #a6adc8;
    font:
      13px "Hack Nerd Font",
      monospace;
  }

  button:hover {
    background: #313244;
  }

  input {
    flex: 1;
    padding: 3px 8px;
    border: 0;
    border-radius: 6px;
    background: #313244;
    color: #cdd6f4;
    font:
      13px "Hack Nerd Font",
      monospace;
  }

  img {
    align-self: center;
    width: 16px;
    height: 16px;
    object-fit: contain;
  }

  .progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    background: #89b4fa;
    transition: width 0.2s;
    pointer-events: none;
  }

  .page {
    position: relative;
    flex: 1;
    min-height: 0;
    /* For the text of its dialogs. */
    user-select: text;
  }

  .page :global(webview) {
    user-select: none;
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
