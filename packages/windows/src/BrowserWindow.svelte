<!--
  A browser window: an address bar over the page. An extension's popup window
  and a site's app window get no address bar, as in Chrome.
-->
<script lang="ts">
  import type { BrowserWindow } from "@domicile-desktop/sdk/desktop/browser";
  import {
    WEBVIEW_CONTEXT_MENU_EVENT,
    WEBVIEW_DIALOG_EVENT,
    WEBVIEW_DIALOG_WITHDRAWN_EVENT,
    WEBVIEW_FILE_CHOOSER_EVENT,
    WEBVIEW_FOCUS_REQUEST_EVENT,
    WEBVIEW_GUEST_FOCUS_EVENT,
    WEBVIEW_GUEST_KEYDOWN_EVENT,
    WEBVIEW_IDENTITY_EVENT,
    WEBVIEW_IDENTITY_WITHDRAWN_EVENT,
    WEBVIEW_PAGE_CHANGE_EVENT,
    WEBVIEW_PAGE_FULLSCREEN_CHANGE_EVENT,
    WEBVIEW_PERMISSION_REQUEST_EVENT,
    WEBVIEW_PERMISSION_REQUEST_WITHDRAWN_EVENT,
    WEBVIEW_PROMPT_EVENT,
    WEBVIEW_PROMPT_WITHDRAWN_EVENT,
    WEBVIEW_SIGN_IN_EVENT,
    WEBVIEW_SIGN_IN_WITHDRAWN_EVENT,
  } from "@domicile-desktop/sdk/webview-element";
  import { commandFor, extensionItemsOf, runsCommands } from "@domicile-svelte/extensions";
  import type { Entry } from "@domicile-svelte/menu";
  import { useDomicile } from "@domicile-svelte/svelte";
  import { tick, untrack } from "svelte";

  import { addressOf } from "./address";
  import { type Ask, dialogAsk } from "./ask";
  import PageAsk from "./PageAsk.svelte";
  import { pageMenu } from "./page-menu";
  import Permission, { type Request } from "./Permission.svelte";
  import { asksTo, permissionMenu } from "./permissions";
  import { promptAsk } from "./prompt";
  import { identityAsk, signInAsk } from "./sign-in";

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
    /** A right click: draw this menu there, on the screen. */
    onmenu: (entries: Entry[], x: number, y: number) => void;
  } = $props();

  const { browser, extensions } = useDomicile();

  type Page = HTMLWebViewElement;

  let frame = $state<HTMLElement>();
  let address = $state<HTMLInputElement>();
  let page = $state<Page>();
  let typed = $state("");
  let request = $state.raw<Request>();
  // What the page asks, oldest first; the engine sends one of a kind at a time.
  let asking = $state.raw<readonly { kind: string; event: Event; ask: Ask }[]>([]);
  let shown = $state<ReturnType<typeof PageAsk>>();
  // The SDK hands the engine's null as undefined. A site opened as an app
  // (`domicile open --app`) is drawn as an application, without one too.
  const chrome = $derived(!fullscreen && browserWindow.popupWindow === undefined && !browserWindow.isApp);

  // The list hands a new object on every change; the view follows the id.
  const id = $derived(browserWindow.id);

  // Ask `ask`, in the place of any other of its kind.
  const asks = (kind: string, event: Event, ask: Ask) => {
    const next = { kind, event, ask };
    asking = asking.some((each) => each.event === event)
      ? asking.map((each) => (each.event === event ? next : each))
      : [...asking.filter((each) => each.kind !== kind), next];
  };
  const asksNo = (kind: string) => {
    const had = hasKeyboard();
    asking = asking.filter((each) => each.kind !== kind);
    regain(had);
  };
  const hasKeyboard = () => frame?.contains(document.activeElement) === true;
  // The keyboard back to the page, if what asked had it.
  const regain = (had: boolean) => {
    if (active && had) {
      void tick().then(focus);
    }
  };
  const answered = (event: Event, answer: () => void) => {
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
    view.addEventListener(WEBVIEW_GUEST_FOCUS_EVENT, () => onfocus());
    view.addEventListener(WEBVIEW_PAGE_FULLSCREEN_CHANGE_EVENT, () => onfullscreen(view.pageFullscreen));
    view.addEventListener(WEBVIEW_FOCUS_REQUEST_EVENT, () => onfocusrequest());
    // The page saw the chord first and let it through.
    view.addEventListener(WEBVIEW_GUEST_KEYDOWN_EVENT, (event) => {
      const binding = bindings[chordOf(event)];
      const extension = binding === undefined && runsCommands(extensions) ? commandFor(extensions, event) : undefined;
      if (binding !== undefined) {
        event.preventDefault();
        binding();
      } else if (extension !== undefined) {
        event.preventDefault();
        extensions.runCommand(extension.id, extension.command.name);
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
    view.addEventListener(WEBVIEW_FILE_CHOOSER_EVENT, (event) => {
      event.preventDefault();
      onfiles(event);
    });
    // Unclaimed, the engine answers no.
    view.addEventListener(WEBVIEW_DIALOG_EVENT, (event) => {
      const ask = dialogAsk(event);
      if (ask !== undefined) {
        event.preventDefault();
        asks("dialog", event, ask);
      }
    });
    view.addEventListener(WEBVIEW_DIALOG_WITHDRAWN_EVENT, () => asksNo("dialog"));
    view.addEventListener(WEBVIEW_SIGN_IN_EVENT, (event) => {
      event.preventDefault();
      asks("sign-in", event, signInAsk(event));
    });
    view.addEventListener(WEBVIEW_SIGN_IN_WITHDRAWN_EVENT, () => asksNo("sign-in"));
    view.addEventListener(WEBVIEW_IDENTITY_EVENT, (event) => {
      event.preventDefault();
      asks("identity", event, identityAsk(event));
    });
    view.addEventListener(WEBVIEW_IDENTITY_WITHDRAWN_EVENT, () => asksNo("identity"));
    view.addEventListener(WEBVIEW_PROMPT_EVENT, (event) => {
      const ask = promptAsk(event);
      if (ask !== undefined) {
        event.preventDefault();
        asks("prompt", event, ask);
      }
    });
    view.addEventListener(WEBVIEW_PROMPT_WITHDRAWN_EVENT, () => asksNo("prompt"));
    // The browser sends one at a time. Unclaimed, the page gets nothing.
    view.addEventListener(WEBVIEW_PERMISSION_REQUEST_EVENT, (event) => {
      const asks = asksTo(event.permissions);
      if (asks === undefined) {
        return;
      }
      event.preventDefault();
      const answering = (answer: () => void) => () => {
        request = undefined;
        answer();
        view.focus();
      };
      request = {
        site: event.origin.replace(/^https:\/\//u, ""),
        asks,
        allow: answering(() => event.allow()),
        deny: answering(() => event.deny()),
        dismiss: answering(() => event.dismiss()),
      };
    });
    view.addEventListener(WEBVIEW_PERMISSION_REQUEST_WITHDRAWN_EVENT, () => {
      request = undefined;
    });
    frame.append(view);
    page = view;
    changed();
    return () => {
      view.remove();
      page = undefined;
      // A view hears of no more; the browser asks the next one again.
      request = undefined;
      asking = [];
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
    } else if (chrome && blank(page?.url ?? "")) {
      address?.focus();
      address?.select();
    } else {
      page?.focus();
    }
  };

  const editAddress = () => {
    if (chrome) {
      address?.focus();
      address?.select();
    }
  };

  // The guest has none of Chrome's own keys.
  const bindings: Record<string, () => void> = {
    "Ctrl+l": editAddress,
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

<div class="browser" onfocusin={onfocus}>
  {#if chrome}
    <form
      onsubmit={(event) => {
        event.preventDefault();
        go(typed);
      }}
    >
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
      <input
        bind:this={address}
        bind:value={typed}
        onkeydown={addressKey}
        spellcheck="false"
        placeholder="Search or type a URL"
      />
    </form>
  {/if}
  <div class="page" bind:this={frame}>
    {#if request !== undefined}<Permission {request} />{/if}
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

  .page {
    position: relative;
    flex: 1;
    min-height: 0;
  }

  .page :global(webview) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
