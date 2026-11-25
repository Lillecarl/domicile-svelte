<!-- Back, Forward, and Reload or Stop. -->
<script lang="ts">
  import { WEBVIEW_HISTORY_CHANGE_EVENT } from "@domicile-desktop/sdk/webview-element";
  import type { Entry } from "@domicile-svelte/menu";

  import { historyMenu } from "./history";

  const {
    view,
    loading,
    onmenu,
  }: {
    view: HTMLWebViewElement;
    loading: boolean;
    onmenu: (entries: Entry[], x: number, y: number) => void;
  } = $props();

  type Side = "back" | "forward";

  const LONG_PRESS_MS = 500;

  let can = $state.raw({ back: false, forward: false });
  let pressing: ReturnType<typeof setTimeout> | undefined;
  // A long press ends in a click too.
  let pressed = false;

  $effect(() => {
    const page = view;
    const read = () => {
      can = { back: page.canGoBack, forward: page.canGoForward };
    };
    read();
    page.addEventListener(WEBVIEW_HISTORY_CHANGE_EVENT, read);
    return () => {
      page.removeEventListener(WEBVIEW_HISTORY_CHANGE_EVENT, read);
      clearTimeout(pressing);
    };
  });

  const list = (side: Side, button: HTMLElement) => {
    const page = view;
    page
      .history()
      .then((history) => {
        const entries = historyMenu(history[side], (id) => page.goToHistoryEntry(id));
        if (entries.length > 0 && button.isConnected) {
          const box = button.getBoundingClientRect();
          onmenu(entries, box.left, box.bottom);
        }
      })
      .catch((error: unknown) => console.error("[windows] history", error));
  };

  const down = (side: Side, event: PointerEvent & { currentTarget: HTMLElement }) => {
    const button = event.currentTarget;
    clearTimeout(pressing);
    pressed = false;
    if (event.button === 0) {
      pressing = setTimeout(() => {
        pressed = true;
        list(side, button);
      }, LONG_PRESS_MS);
    }
  };

  const step = (side: Side, inNewWindow: boolean) => {
    clearTimeout(pressing);
    if (side === "back") {
      inNewWindow ? view.goBackInNewWindow() : view.goBack();
    } else {
      inNewWindow ? view.goForwardInNewWindow() : view.goForward();
    }
  };
</script>

{#snippet way(side: Side, label: string, glyph: string)}
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={!can[side]}
    onmousedown={(event) => event.preventDefault()}
    onpointerdown={(event) => down(side, event)}
    onpointerup={() => clearTimeout(pressing)}
    onpointerleave={() => clearTimeout(pressing)}
    onclick={(event) => {
      if (!pressed) {
        step(side, event.ctrlKey);
      }
    }}
    onauxclick={(event) => {
      if (event.button === 1) {
        step(side, true);
      }
    }}
    oncontextmenu={(event) => {
      event.preventDefault();
      list(side, event.currentTarget);
    }}
  >
    {glyph}
  </button>
{/snippet}

{@render way("back", "Back", "\u{f004d}")}
{@render way("forward", "Forward", "\u{f0054}")}
<button
  type="button"
  title={loading ? "Stop" : "Reload"}
  aria-label={loading ? "Stop" : "Reload"}
  onmousedown={(event) => event.preventDefault()}
  onclick={() => (loading ? view.stop() : view.reload())}
>
  {loading ? "\u{f0156}" : "\u{f0450}"}
</button>

<style>
  button {
    padding: 0 6px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: #a6adc8;
    font:
      15px "Hack Nerd Font",
      monospace;
  }

  button:not(:disabled):hover {
    background: #313244;
  }

  button:disabled {
    opacity: 0.4;
  }
</style>
