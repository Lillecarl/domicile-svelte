<!--
  A browser window: an address bar over the page. An extension's popup window
  shows an extension page and gets no address bar, as in Chrome.
-->
<script lang="ts">
  import type { BrowserWindow } from "@domicile-desktop/sdk/desktop/browser";
  import {
    WEBVIEW_FOCUS_REQUEST_EVENT,
    WEBVIEW_GUEST_FOCUS_EVENT,
    WEBVIEW_GUEST_KEYDOWN_EVENT,
    WEBVIEW_PAGE_CHANGE_EVENT,
  } from "@domicile-desktop/sdk/webview-element";
  import { untrack } from "svelte";

  const {
    window: browserWindow,
    onfocus,
    onfocusrequest,
  }: {
    window: BrowserWindow;
    /** The page or the address bar took focus. */
    onfocus: () => void;
    /** The page or an extension asked to be raised. */
    onfocusrequest: () => void;
  } = $props();

  type Page = HTMLWebViewElement;

  let frame = $state<HTMLElement>();
  let address = $state<HTMLInputElement>();
  let page = $state<Page>();
  let typed = $state("");
  // The SDK hands the engine's null as undefined.
  const chrome = $derived(browserWindow.popupWindow === undefined);

  // The list hands a new object on every change; the view follows the id.
  const id = $derived(browserWindow.id);

  const mountView = (frame: HTMLElement, id: string) => {
    // The engine reads `window` once, when the view connects, and a window
    // shows in one view at a time: create it here, once, attribute first.
    const view = document.createElement("webview") as Page;
    view.setAttribute("window", id);
    const changed = () => {
      if (document.activeElement !== address) {
        typed = view.url;
      }
    };
    view.addEventListener(WEBVIEW_PAGE_CHANGE_EVENT, changed);
    view.addEventListener(WEBVIEW_GUEST_FOCUS_EVENT, () => onfocus());
    view.addEventListener(WEBVIEW_FOCUS_REQUEST_EVENT, () => onfocusrequest());
    // The page saw the chord first and let it through.
    view.addEventListener(WEBVIEW_GUEST_KEYDOWN_EVENT, (event) => {
      const binding = bindings[chordOf(event)];
      if (binding !== undefined) {
        event.preventDefault();
        binding();
      }
    });
    frame.append(view);
    page = view;
    changed();
    return () => view.remove();
  };

  // Untracked past `frame` and `id`: anything else read here would remake the
  // view, and the page with it.
  $effect(() => {
    if (frame !== undefined) {
      const target = frame;
      const window = id;
      return untrack(() => mountView(target, window));
    }
  });

  const blank = (url: string) => url === "" || url === "about:blank";

  /** Focus the page, or the address bar while the page is blank. */
  export const focus = () => {
    if (chrome && blank(page?.url ?? "")) {
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

  const go = (text: string) => {
    const trimmed = text.trim();
    if (page === undefined || trimmed === "") {
      return;
    }
    const url = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
      ? trimmed
      : /^[^\s]+\.[^\s]+$/.test(trimmed)
        ? `https://${trimmed}`
        : `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
    page.src = url;
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
      <input
        bind:this={address}
        bind:value={typed}
        onkeydown={addressKey}
        spellcheck="false"
        placeholder="Search or type a URL"
      />
    </form>
  {/if}
  <div class="page" bind:this={frame}></div>
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
    padding: 4px;
  }

  input {
    flex: 1;
    padding: 3px 8px;
    border: 0;
    border-radius: 6px;
    background: #313244;
    color: #cdd6f4;
    font: 13px "Hack Nerd Font", monospace;
  }

  .page {
    flex: 1;
    min-height: 0;
  }

  .page :global(webview) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
