<!-- One item on the bar. A button when it handles any input, plain text otherwise. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  const {
    children,
    title,
    onclick,
    oncontextmenu,
    onwheel,
  }: {
    children: Snippet;
    title?: string;
    onclick?: (event: MouseEvent) => void;
    oncontextmenu?: (event: MouseEvent) => void;
    onwheel?: (event: WheelEvent) => void;
  } = $props();
</script>

{#if onclick === undefined && oncontextmenu === undefined && onwheel === undefined}
  <span class="item" {title}>{@render children()}</span>
{:else}
  <button class="item" type="button" {title} {onclick} {oncontextmenu} {onwheel}>{@render children()}</button>
{/if}

<style>
  .item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: calc(var(--bar-height, 32px) - 8px);
    padding: 0 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font: inherit;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  button.item:hover {
    background: var(--bar-theme-hover, #313244);
  }
</style>
