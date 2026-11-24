<!--
  A popup menu with its corner at (`x`, `y`), kept on the screen. It has the
  keyboard while open; whoever assigns focus takes it back in `onclose`.
-->
<script lang="ts">
  import { useDomicile } from "@domicile-svelte/svelte";
  import { untrack } from "svelte";

  import { beside, type Entry, fitted, type Item, itemOf, levels, opened, stepped } from "./walk";

  const {
    entries,
    x,
    y,
    label,
    trigger,
    onclose,
  }: {
    entries: readonly Entry[];
    x: number;
    y: number;
    label: string;
    /** What opened the menu: its own press toggles the menu, so it does not close it here. */
    trigger?: HTMLElement | undefined;
    /** The caller unmounts it. Called after the chosen item ran. */
    onclose: () => void;
  } = $props();

  const { windows } = useDomicile();
  let root = $state<HTMLElement | null>();
  /** The keys of the open submenus, outermost first. */
  let open = $state<readonly string[]>([]);
  /** The highlighted key in the innermost menu. */
  let at = $state<string>();

  const shown = $derived(levels(entries, open));
  const inner = $derived(shown.at(-1) ?? []);

  const expand = (level: number, item: Item) => {
    item.onshow?.();
    open = [...open.slice(0, level), item.key];
    at = undefined;
  };

  const choose = (level: number, item: Item) => {
    if (!item.enabled) {
      return;
    }
    if (item.submenu === undefined) {
      item.run?.();
      onclose();
    } else {
      expand(level, item);
    }
  };

  const hover = (level: number, item: Item) => {
    if (open[level] === item.key) {
      return;
    }
    if (item.enabled && item.submenu !== undefined) {
      expand(level, item);
    } else {
      open = open.slice(0, level);
      at = item.enabled ? item.key : undefined;
    }
  };

  const keydown = (event: KeyboardEvent) => {
    const level = shown.length - 1;
    const item = itemOf(inner, at);
    switch (event.key) {
      case "ArrowDown":
        at = stepped(inner, at, 1);
        break;
      case "ArrowUp":
        at = stepped(inner, at, -1);
        break;
      case "ArrowRight":
      case "Enter":
      case " ":
        if (item !== undefined && (event.key !== "ArrowRight" || item.submenu !== undefined)) {
          choose(level, item);
          at = item.submenu === undefined ? at : stepped(item.submenu, undefined, 1);
        }
        break;
      case "ArrowLeft":
      case "Escape":
        if (level > 0) {
          at = opened(entries, open).at(-1)?.key;
          open = open.slice(0, level - 1);
        } else if (event.key === "Escape") {
          onclose();
        }
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  $effect(() => {
    if (root === undefined || root === null) {
      return;
    }
    const box = root;
    return untrack(() => {
      windows.focusShell();
      box.focus();
      const pressed = (event: Event) => {
        const target = event.target;
        if (target instanceof Node && !box.contains(target) && trigger?.contains(target) !== true) {
          onclose();
        }
      };
      // A press in a webview reaches this page only as its focus.
      const focused = (event: Event) => {
        if (event.target instanceof Element && event.target.localName === "webview") {
          onclose();
        }
      };
      document.addEventListener("pointerdown", pressed, true);
      document.addEventListener("focusin", focused);
      return () => {
        document.removeEventListener("pointerdown", pressed, true);
        document.removeEventListener("focusin", focused);
      };
    });
  });

  // Placed once its size is known; again when its entries change.
  const place = (level: number) => (list: HTMLElement) => {
    void shown[level];
    const row = level === 0 ? null : root?.querySelector(`[data-level="${level - 1}"] [aria-expanded="true"]`);
    const box = row?.getBoundingClientRect();
    const left =
      box === undefined ? fitted(x, list.offsetWidth, innerWidth) : beside(box, list.offsetWidth, innerWidth);
    list.style.left = `${left}px`;
    list.style.top = `${fitted(box === undefined ? y : box.top - 5, list.offsetHeight, innerHeight)}px`;
  };
</script>

<div bind:this={root} class="root" role="menu" aria-label={label} tabindex="-1" onkeydown={keydown}>
  {#each shown as level, index (index === 0 ? "" : open.slice(0, index).join("\0"))}
    <div class="list" data-level={index} {@attach place(index)}>
      {#each level as entry (entry.key)}
        {#if entry.kind === "separator"}
          <hr />
        {:else}
          {@const lit = index === shown.length - 1 && entry.key === at}
          <button
            type="button"
            role={entry.toggle === undefined
              ? "menuitem"
              : entry.toggle.kind === "check"
                ? "menuitemcheckbox"
                : "menuitemradio"}
            aria-checked={entry.toggle?.on}
            aria-expanded={entry.submenu === undefined ? undefined : open[index] === entry.key}
            aria-disabled={!entry.enabled}
            class:lit={lit || open[index] === entry.key}
            tabindex="-1"
            onpointerenter={() => hover(index, entry)}
            onclick={() => choose(index, entry)}
          >
            <span class="mark">
              {#if entry.toggle?.on}{entry.toggle.kind === "check" ? "✓" : "●"}
              {:else if entry.image !== undefined}<img src={entry.image} alt="" />{/if}
            </span>
            <span class="label">{entry.label}</span>
            {#if entry.hint !== undefined}<span class="hint">{entry.hint}</span>{/if}
            {#if entry.submenu !== undefined}<span class="hint">›</span>{/if}
          </button>
        {/if}
      {/each}
    </div>
  {/each}
</div>

<style>
  .root {
    outline: none;
  }

  .list {
    position: fixed;
    z-index: 40;
    display: flex;
    flex-direction: column;
    min-width: 160px;
    max-width: min(420px, 100vw);
    max-height: 100vh;
    box-sizing: border-box;
    padding: 4px;
    border: 1px solid #45475a;
    border-radius: 8px;
    background: #1e1e2e;
    box-shadow: 0 4px 16px #0008;
    color: #cdd6f4;
    font: 13px "Hack Nerd Font", monospace;
    overflow-y: auto;
    user-select: none;
  }

  button {
    display: flex;
    flex: none;
    gap: 8px;
    align-items: center;
    padding: 5px 8px;
    border: 0;
    border-radius: 5px;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
  }

  button.lit {
    background: #313244;
  }

  button[aria-disabled="true"] {
    color: #6c7086;
  }

  .mark {
    flex: none;
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
  }

  img {
    width: 16px;
    height: 16px;
    object-fit: contain;
  }

  .label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hint {
    color: #7f849c;
  }

  /* Between two are items the application hides. */
  hr + hr,
  hr:first-child,
  hr:last-child {
    display: none;
  }

  hr {
    flex: none;
    width: calc(100% - 8px);
    margin: 4px;
    border: 0;
    border-top: 1px solid #45475a;
  }
</style>
