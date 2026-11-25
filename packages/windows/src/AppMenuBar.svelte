<!-- An Electron app's menu bar, over its window's page. -->
<script lang="ts">
  import { type AppMenuItem, MenuEntryKind, type AppMenuEntry } from "@domicile-desktop/sdk/app-menu";
  import type { Entry } from "@domicile-svelte/menu";

  import { appEntries } from "./app-menu";

  const {
    entries,
    onmenu,
    onchoose,
    onclose,
  }: {
    entries: readonly AppMenuEntry[];
    onmenu: (entries: Entry[], x: number, y: number, onclose?: () => void) => void;
    /** The entry chosen; the app runs it. */
    onchoose: (id: number) => void;
    /** A menu of the bar's was put away. */
    onclose: () => void;
  } = $props();

  let bar = $state<HTMLElement>();
  const items = $derived(
    entries.filter((entry): entry is AppMenuItem & { kind: MenuEntryKind.Item } => entry.kind === MenuEntryKind.Item),
  );

  /** Open the menu of entry `id`. */
  export const open = (id: number) => {
    const at = items.findIndex((item) => item.id === id);
    const button = bar?.children[at];
    const item = items[at];
    if (item === undefined || button === undefined || !item.enabled) {
      return;
    }
    if (item.submenu === undefined) {
      onchoose(id);
      onclose();
      return;
    }
    const box = button.getBoundingClientRect();
    onmenu(appEntries(item.submenu, onchoose), box.left, box.bottom, onclose);
  };
</script>

<div class="bar" role="menubar" aria-label="Application menu" bind:this={bar}>
  {#each items as item (item.id)}
    {@const at = item.mnemonic ?? item.label.length}
    <button
      type="button"
      role="menuitem"
      tabindex="-1"
      disabled={!item.enabled}
      onmousedown={(event) => event.preventDefault()}
      onclick={() => open(item.id)}
    >
      {item.label.slice(0, at)}<u>{item.label.slice(at, at + 1)}</u>{item.label.slice(at + 1)}
    </button>
  {/each}
</div>

<style>
  .bar {
    display: flex;
    gap: 2px;
    padding: 2px 4px;
    overflow: hidden;
  }

  button {
    flex: none;
    padding: 2px 8px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: #cdd6f4;
    font:
      13px "Hack Nerd Font",
      monospace;
    white-space: pre;
  }

  button:not(:disabled):hover {
    background: #313244;
  }

  button:disabled {
    color: #6c7086;
  }
</style>
