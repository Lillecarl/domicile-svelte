<!--
  One search over `sources`, over the desktop. Enter runs the selected row;
  Up and Down, Ctrl+N and Ctrl+P move; Escape, or focus leaving, closes.
-->
<script lang="ts">
  import { useDomicile } from "@domicile-svelte/svelte";

  import type { Item, Source } from "./item";

  const {
    sources,
    placeholder = "Search",
    onclose,
  }: {
    sources: readonly Source[];
    placeholder?: string;
    /** Called before a row runs, so the row's own focus change wins. */
    onclose: () => void;
  } = $props();

  const { windows } = useDomicile();

  let query = $state("");
  let selected = $state(0);
  let input = $state<HTMLInputElement>();
  let list = $state<HTMLElement>();
  const items = $derived(sources.flatMap((source) => source.search(query)));
  const chosen = $derived(Math.min(selected, items.length - 1));

  // A page has the keyboard until the shell takes it.
  $effect(() => {
    if (input !== undefined) {
      windows.focusShell();
      input.focus();
    }
  });

  $effect(() => {
    list?.children[chosen]?.scrollIntoView({ block: "nearest" });
  });

  const run = (item: Item | undefined) => {
    if (item === undefined) {
      return;
    }
    onclose();
    Promise.resolve(item.run()).catch((error: unknown) => console.error("[launcher]", item.key, error));
  };

  const step = (by: number) => {
    selected = Math.max(0, Math.min(items.length - 1, chosen + by));
  };

  const keydown = (event: KeyboardEvent) => {
    const ctrl = event.ctrlKey && !event.altKey && !event.metaKey;
    switch (true) {
      case event.key === "Escape":
        onclose();
        break;
      case event.key === "Enter":
        run(items[chosen]);
        break;
      case event.key === "ArrowDown" || (ctrl && event.key === "n"):
        step(1);
        break;
      case event.key === "ArrowUp" || (ctrl && event.key === "p"):
        step(-1);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const focusout = (event: FocusEvent) => {
    const to = event.relatedTarget;
    if (!(to instanceof Node && event.currentTarget instanceof Node && event.currentTarget.contains(to))) {
      onclose();
    }
  };
</script>

<div class="launcher" role="dialog" aria-label={placeholder} onfocusout={focusout}>
  <input
    bind:this={input}
    bind:value={query}
    oninput={() => (selected = 0)}
    onkeydown={keydown}
    {placeholder}
    spellcheck="false"
  />
  <ul bind:this={list}>
    {#each items as item, index (item.key)}
      <li>
        <button
          class:chosen={index === chosen}
          tabindex="-1"
          onpointermove={() => (selected = index)}
          onclick={() => run(item)}
        >
          <span class="icon">
            {#if item.icon !== undefined}<img src={item.icon} alt="" />{/if}
          </span>
          <span class="label">{item.label}</span>
          {#if item.detail}<span class="detail">{item.detail}</span>{/if}
        </button>
      </li>
    {/each}
  </ul>
</div>

<style>
  .launcher {
    position: fixed;
    top: 18vh;
    left: 50%;
    z-index: 20;
    display: flex;
    flex-direction: column;
    width: min(640px, calc(100vw - 32px));
    max-height: 60vh;
    translate: -50% 0;
    border: 2px solid #74c7ec;
    border-radius: 10px;
    background: #1e1e2e;
    box-shadow: 0 12px 48px #000c;
    overflow: hidden;
    font: 14px "Hack Nerd Font", monospace;
    color: #cdd6f4;
  }

  input {
    padding: 10px 14px;
    border: 0;
    border-bottom: 1px solid #313244;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 16px;
    outline: none;
  }

  ul {
    margin: 0;
    padding: 4px;
    list-style: none;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #45475a transparent;
  }

  button {
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
    padding: 6px 10px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .chosen {
    background: #313244;
  }

  .icon {
    flex: none;
    width: 24px;
    height: 24px;
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .label {
    flex: none;
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail {
    flex: 1;
    overflow: hidden;
    color: #7f849c;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
