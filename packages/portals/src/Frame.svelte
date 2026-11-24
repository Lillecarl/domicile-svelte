<!--
  A dialog's box and buttons. Cancel has the focus first, so an Enter typed
  for something else grants nothing; a dialog that gives nothing away passes
  `eager`, and its own field or the accept button has it.
-->
<script lang="ts">
  import { useDomicile } from "@domicile-svelte/svelte";
  import type { Snippet } from "svelte";

  const {
    title,
    accept,
    deny = "Cancel",
    danger = false,
    disabled = false,
    eager = false,
    onaccept,
    oncancel,
    children,
    extra,
  }: {
    title: string;
    accept: string;
    deny?: string;
    danger?: boolean;
    disabled?: boolean;
    eager?: boolean;
    onaccept: () => void;
    oncancel: () => void;
    children?: Snippet;
    /** More buttons, before Cancel. */
    extra?: Snippet;
  } = $props();

  const { windows } = useDomicile();
  let form = $state<HTMLElement | null>();

  // A page has the keyboard until the shell takes it.
  $effect(() => {
    if (form !== undefined && form !== null) {
      windows.focusShell();
      const field = form.querySelector<HTMLElement>("main input, main select");
      const button = form.querySelector<HTMLElement>(eager ? ".accept" : ".deny");
      ((eager ? field : undefined) ?? button)?.focus();
    }
  });

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!disabled) {
      onaccept();
    }
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      oncancel();
    }
  };
</script>

<div class="cover" role="dialog" aria-label={title} tabindex="-1" onkeydown={keydown}>
  <form bind:this={form} class:danger onsubmit={submit}>
    <header>{title}</header>
    {#if children !== undefined}<main>{@render children()}</main>{/if}
    <footer>
      {@render extra?.()}
      <span class="space"></span>
      <button type="button" class="deny" onclick={oncancel}>{deny}</button>
      <button type="submit" class="accept" {disabled}>{accept}</button>
    </footer>
  </form>
</div>

<style>
  .cover {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: grid;
    place-items: center;
    background: #0008;
  }

  form {
    --accent: #74c7ec;
    display: flex;
    flex-direction: column;
    width: min(560px, calc(100vw - 32px));
    max-height: calc(100vh - 64px);
    border: 2px solid var(--accent);
    border-radius: 10px;
    background: #1e1e2e;
    box-shadow: 0 12px 48px #000c;
    overflow: hidden;
    font:
      14px "Hack Nerd Font",
      monospace;
    color: #cdd6f4;
  }

  form.danger {
    --accent: #f38ba8;
  }

  header {
    padding: 12px;
    font-weight: bold;
  }

  main {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid #313244;
    overflow-y: auto;
  }

  main :global(p) {
    margin: 0;
  }

  main :global(label) {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }

  main :global(.note) {
    color: #7f849c;
    font-size: 12px;
  }

  main :global(.bad) {
    color: #f38ba8;
  }

  form :global(button),
  form :global(select),
  form :global(input:not([type="checkbox"], [type="radio"])) {
    padding: 4px 12px;
    border: 0;
    border-radius: 6px;
    background: #313244;
    color: inherit;
    font: inherit;
  }

  form :global(:focus-visible) {
    outline: 2px solid #cdd6f4;
  }

  form :global(button:disabled) {
    opacity: 0.5;
  }

  footer {
    display: flex;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid #313244;
  }

  .space {
    flex: 1;
  }

  form .accept {
    background: var(--accent);
    color: #1e1e2e;
  }
</style>
