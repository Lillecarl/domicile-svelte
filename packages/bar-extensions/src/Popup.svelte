<!--
  An extension's popup in a panel below the bar, right-aligned to `right`.
  Withheld until its page has sized itself and loaded, as Chrome shows it. It
  takes the keyboard while open; whoever assigns focus takes it back.
-->
<script lang="ts">
  import {
    WEBVIEW_CLOSE_EVENT,
    WEBVIEW_CONTENT_SIZE_CHANGE_EVENT,
    WEBVIEW_LOADING_CHANGE_EVENT,
  } from "@domicile-desktop/sdk/webview-element";
  import { useDomicile } from "@domicile-svelte/svelte";
  import { untrack } from "svelte";

  const {
    url,
    profile,
    right,
    trigger,
    onclose,
  }: {
    url: string;
    /** The browser profile the extension is in, with its storage and sign-ins. */
    profile: string;
    right: number;
    /** The button that opened the panel. */
    trigger: HTMLElement | undefined;
    /** Called to close the panel; the caller unmounts it. */
    onclose: () => void;
  } = $props();

  const { windows } = useDomicile();
  // `domicile set-log-level debug shell` shows these.
  const log = (...words: unknown[]) => console.debug("[bar-extensions]", ...words);

  type PopupView = HTMLElement & { contentWidth: number; contentHeight: number; loading: boolean };

  let panel = $state<HTMLElement>();
  let shown = $state(false);

  const mountView = (panel: HTMLElement, url: string) => {
    // The engine reads `extensionpopup` once, when the view connects: Svelte
    // markup cannot promise it is set first.
    const view = document.createElement("webview") as PopupView;
    view.setAttribute("extensionpopup", "");
    view.setAttribute("profile", profile);
    view.setAttribute("src", url);
    // Until the page reports a size the view keeps its intrinsic 300x150: a
    // 0x0 view never lays its page out, so the page never sizes itself.
    const read = () => {
      const { contentWidth: width, contentHeight: height, loading } = view;
      log("page", `${width}x${height}`, loading ? "loading" : "loaded");
      if (width > 0 || height > 0) {
        view.style.width = `${width}px`;
        view.style.height = `${height}px`;
        shown ||= !loading;
      }
    };
    const close = (why: string) => {
      log("close:", why);
      onclose();
    };
    view.addEventListener(WEBVIEW_CONTENT_SIZE_CHANGE_EVENT, read);
    view.addEventListener(WEBVIEW_LOADING_CHANGE_EVENT, read);
    view.addEventListener(WEBVIEW_CLOSE_EVENT, () => close("window.close()"));
    log("open", url);
    panel.append(view);
    read();

    windows.focusShell();
    view.focus();

    // A press on an `<app>` is a press in this page too. The trigger's own
    // click toggles the panel.
    const pressed = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && !panel.contains(target) && !trigger?.contains(target)) {
        close(`press on ${target.nodeName}`);
      }
    };
    // A press in another `<webview>` never reaches this page, but its focus
    // does. Only a webview's: taking the keyboard back refocuses the page's
    // last focused element, often an `<app>`, and that is no press.
    const focused = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.localName === "webview" && !panel.contains(target)) {
        close("focus in another webview");
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close("Escape");
      }
    };
    document.addEventListener("pointerdown", pressed, true);
    document.addEventListener("focusin", focused);
    document.addEventListener("keydown", escape);

    return () => {
      document.removeEventListener("pointerdown", pressed, true);
      document.removeEventListener("focusin", focused);
      document.removeEventListener("keydown", escape);
      log("closed");
      view.remove();
    };
  };

  // One view per panel and url. The view's events write state, so the rest
  // runs untracked; tracked, each write would remake the view.
  $effect(() => {
    if (panel !== undefined) {
      const target = panel;
      return untrack(() => mountView(target, url));
    }
  });
</script>

<div class="panel" bind:this={panel} style:right="{right}px" class:withheld={!shown}></div>

<style>
  .panel {
    position: fixed;
    top: calc(var(--bar-height, 32px) + 4px);
    z-index: 10;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 16px #0008;
  }

  /* Opacity, not visibility: a page under `visibility: hidden` stops drawing,
     so it never sizes itself and never shows. */
  .withheld {
    opacity: 0;
    pointer-events: none;
  }

  .panel :global(webview) {
    display: block;
    border: 0;
  }
</style>
