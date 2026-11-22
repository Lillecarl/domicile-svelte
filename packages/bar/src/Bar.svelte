<!--
  The bar. Items go in three snippets; colors come from the --bar-* custom
  properties, so a shell themes it from outside.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  const { left, center, right }: { left?: Snippet; center?: Snippet; right?: Snippet } = $props();
</script>

<header class="bar">
  <div class="left">{@render left?.()}</div>
  <div class="center">{@render center?.()}</div>
  <div class="right">{@render right?.()}</div>
</header>

<style>
  .bar {
    --bar-base: var(--bar-theme-base, #1e1e2e);
    --bar-text: var(--bar-theme-text, #cdd6f4);
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
    height: var(--bar-height, 32px);
    padding: 0 8px;
    box-sizing: border-box;
    background: var(--bar-base);
    color: var(--bar-text);
    font: 14px "Hack Nerd Font", monospace;
    user-select: none;
  }

  .left,
  .center,
  .right {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .center {
    justify-content: center;
  }

  .right {
    justify-content: flex-end;
  }
</style>
