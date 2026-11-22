<!--
  An extension's popup in a panel below the bar, right-aligned to `right`.
  Hidden until its page has sized itself and loaded, as Chrome shows it.
-->
<script lang="ts">
  import {
    WEBVIEW_CLOSE_EVENT,
    WEBVIEW_CONTENT_SIZE_CHANGE_EVENT,
    WEBVIEW_LOADING_CHANGE_EVENT,
  } from "@domicile-desktop/sdk/webview-element";
  import { useDomicile } from "@domicile-svelte/svelte";

  const { url, right, onclose }: { url: string; right: number; onclose: () => void } = $props();

  const { windows } = useDomicile();

  type PopupView = HTMLElement & { contentWidth: number; contentHeight: number; loading: boolean };

  let panel = $state<HTMLElement>();
  let width = $state(0);
  let height = $state(0);
  let loading = $state(true);

  $effect(() => {
    if (panel === undefined) {
      return;
    }
    // The engine reads `extensionpopup` once, when the view connects: Svelte
    // markup cannot promise it is set first.
    const view = document.createElement("webview") as PopupView;
    view.setAttribute("extensionpopup", "");
    view.setAttribute("src", url);
    const resize = () => {
      width = view.contentWidth;
      height = view.contentHeight;
    };
    const load = () => {
      loading = view.loading;
    };
    view.addEventListener(WEBVIEW_CONTENT_SIZE_CHANGE_EVENT, resize);
    view.addEventListener(WEBVIEW_LOADING_CHANGE_EVENT, load);
    view.addEventListener(WEBVIEW_CLOSE_EVENT, onclose);
    panel.append(view);

    const before = windows.focused;
    windows.focusShell();
    view.focus();

    const outside = (event: Event) => {
      // A press on an action button is that button's click to handle.
      const target = event.target;
      if (target instanceof Element && target.closest("[data-extension-action]") !== null) {
        return;
      }
      if (target instanceof Node && !panel?.contains(target)) {
        onclose();
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onclose();
      }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    // A press on a client window never reaches the page; its focus does.
    const unfocus = windows.on("focuschange", () => {
      if (windows.focused !== undefined) {
        onclose();
      }
    });

    return () => {
      unfocus();
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
      view.remove();
      if (before !== undefined && windows.focused === undefined) {
        windows.focus(before);
      }
    };
  });
</script>

<div
  class="panel"
  bind:this={panel}
  style:right="{right}px"
  style:width="{width}px"
  style:height="{height}px"
  class:shown={width > 0 && height > 0 && !loading}
></div>

<style>
  .panel {
    position: fixed;
    top: calc(var(--bar-height, 32px) + 4px);
    z-index: 10;
    visibility: hidden;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 16px #0008;
  }

  .shown {
    visibility: visible;
  }

  .panel :global(webview) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
