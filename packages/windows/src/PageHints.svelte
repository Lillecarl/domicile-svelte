<!-- What a browser draws over its page: the link under the pointer, and a tooltip. -->
<script lang="ts">
  import { WEBVIEW_TARGET_URL_CHANGE_EVENT, WEBVIEW_TOOLTIP_CHANGE_EVENT } from "@domicile-desktop/sdk/webview-element";

  import { tipPlace } from "./hints";

  const { view }: { view: HTMLWebViewElement } = $props();

  let link = $state("");
  let tip = $state.raw({ text: "", x: 0, y: 0 });

  $effect(() => {
    const page = view;
    const readLink = () => {
      link = page.targetUrl;
    };
    const readTip = () => {
      tip = { text: page.tooltip, x: page.tooltipX, y: page.tooltipY };
    };
    readLink();
    readTip();
    page.addEventListener(WEBVIEW_TARGET_URL_CHANGE_EVENT, readLink);
    page.addEventListener(WEBVIEW_TOOLTIP_CHANGE_EVENT, readTip);
    return () => {
      page.removeEventListener(WEBVIEW_TARGET_URL_CHANGE_EVENT, readLink);
      page.removeEventListener(WEBVIEW_TOOLTIP_CHANGE_EVENT, readTip);
    };
  });

  // Placed once its size is known; again for each text.
  const place = (box: HTMLElement) => {
    const { left, top } = tipPlace(
      tip,
      { width: box.offsetWidth, height: box.offsetHeight },
      { width: view.clientWidth, height: view.clientHeight },
    );
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
  };
</script>

{#if link !== ""}<output aria-label="Link">{link}</output>{/if}
{#if tip.text !== ""}<div role="tooltip" {@attach place}>{tip.text}</div>{/if}

<style>
  output,
  div {
    position: absolute;
    z-index: 1;
    box-sizing: border-box;
    border: 1px solid #45475a;
    background: #1e1e2e;
    color: #cdd6f4;
    font:
      12px "Hack Nerd Font",
      monospace;
    pointer-events: none;
  }

  output {
    bottom: 0;
    left: 0;
    max-width: 50%;
    padding: 2px 8px;
    border-width: 1px 1px 0 0;
    border-radius: 0 6px 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  div {
    top: 0;
    left: 0;
    width: max-content;
    max-width: min(352px, 90%);
    padding: 5px 9px;
    border-radius: 6px;
    box-shadow: 0 4px 16px #0008;
    overflow-wrap: anywhere;
    white-space: pre-line;
  }
</style>
