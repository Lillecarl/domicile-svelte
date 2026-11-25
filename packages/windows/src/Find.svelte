<!-- Find in page. The count is the browser's, which looks in every frame. -->
<script lang="ts">
  import { WEBVIEW_FIND_CHANGE_EVENT } from "@domicile-desktop/sdk/webview-element";
  import { useDomicile } from "@domicile-svelte/svelte";
  import { onMount } from "svelte";

  const { view, onclose }: { view: HTMLWebViewElement; onclose: () => void } = $props();

  const { windows } = useDomicile();
  let input = $state<HTMLInputElement>();
  let text = $state("");
  let matches = $state(0);
  let at = $state(0);

  /** Take the keyboard. */
  export const focus = () => {
    windows.focusShell();
    input?.focus();
    input?.select();
  };

  onMount(() => {
    const read = () => {
      matches = view.findMatches;
      at = view.findActiveMatch;
    };
    view.addEventListener(WEBVIEW_FIND_CHANGE_EVENT, read);
    focus();
    return () => {
      view.removeEventListener(WEBVIEW_FIND_CHANGE_EVENT, read);
      view.stopFinding();
    };
  });

  const keydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onclose();
    } else if (event.key === "Enter" && text !== "") {
      event.preventDefault();
      view.find(text, event.shiftKey);
    } else if (event.key === "f" && event.ctrlKey) {
      event.preventDefault();
      input?.select();
    }
  };
</script>

<search class="find">
  <input
    bind:this={input}
    bind:value={text}
    oninput={() => view.find(text)}
    onkeydown={keydown}
    aria-label="Find in page"
    placeholder="Find in page"
    spellcheck="false"
  />
  <span class="count" class:none={text !== "" && matches === 0}>{at}/{matches}</span>
  <button type="button" aria-label="Previous" disabled={matches === 0} onclick={() => view.find(text, true)}>↑</button>
  <button type="button" aria-label="Next" disabled={matches === 0} onclick={() => view.find(text)}>↓</button>
  <button type="button" aria-label="Close" onclick={onclose}>✕</button>
</search>

<style>
  .find {
    position: absolute;
    top: 8px;
    right: 16px;
    z-index: 1;
    display: flex;
    gap: 4px;
    align-items: center;
    box-sizing: border-box;
    max-width: calc(100% - 32px);
    padding: 4px;
    border: 1px solid #45475a;
    border-radius: 8px;
    background: #1e1e2e;
    box-shadow: 0 8px 24px #000a;
    color: #cdd6f4;
    font:
      13px "Hack Nerd Font",
      monospace;
  }

  input {
    min-width: 0;
    padding: 4px 8px;
    border: 0;
    border-radius: 6px;
    background: #313244;
    color: inherit;
    font: inherit;
  }

  .count {
    min-width: 4em;
    color: #a6adc8;
    text-align: center;
  }

  .none {
    color: #f38ba8;
  }

  button {
    padding: 4px 8px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: inherit;
    font: inherit;
  }

  button:not(:disabled):hover {
    background: #313244;
  }

  button:disabled {
    opacity: 0.5;
  }
</style>
