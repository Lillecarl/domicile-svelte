<!--
  The keybindings, to learn them: a keyboard whose keys light up with what
  they do under the modifiers held, and a list to search. Holding Meta,
  Shift, Ctrl or Alt shows that set; clicking a modifier key pins it. A chord
  the shell grabs, pressed while this is open, is shown rather than run
  (`heard`). Escape, or focus leaving, closes.
-->
<script lang="ts">
  import { useDomicile } from "@domicile-svelte/svelte";
  import { SvelteSet } from "svelte/reactivity";

  import {
    type Binding,
    boundWith,
    type Group,
    matching,
    MODIFIERS,
    type Modifier,
    partsOf,
    shownChord,
    shownKey,
  } from "./binding";
  import { capOf, KEYBOARD, MODIFIER_KEYS } from "./keyboard";

  const {
    bindings,
    onclose,
  }: {
    bindings: readonly Binding[];
    onclose: () => void;
  } = $props();

  const { windows } = useDomicile();

  const held = new SvelteSet<Modifier>();
  // Meta to start with: nearly every binding holds it.
  const pinned = new SvelteSet<Modifier>(["Meta"]);
  let query = $state("");
  let picked = $state<Binding>();
  // bind:this sets null, not undefined, when the field goes.
  let input = $state<HTMLInputElement | null>();

  const modifiers = $derived<ReadonlySet<Modifier>>(held.size > 0 ? held : pinned);
  const bound = $derived(boundWith(bindings, modifiers));
  const listed = $derived(
    matching(bindings, query).filter((binding) => modifiers.size === 0 || boundWith([binding], modifiers).size > 0),
  );

  /** A chord the shell grabs was pressed: show what it does. */
  export const heard = (chord: string) => {
    picked = bindings.find((binding) => binding.chord === chord);
  };

  // A page has the keyboard until the shell takes it.
  $effect(() => {
    if (input !== undefined && input !== null) {
      windows.focusShell();
      input.focus();
    }
  });

  const MODIFIER_NAMES: Readonly<Record<string, Modifier>> = {
    Alt: "Alt",
    Control: "Ctrl",
    Meta: "Meta",
    OS: "Meta",
    Shift: "Shift",
  };

  const keydown = (event: KeyboardEvent) => {
    const modifier = MODIFIER_NAMES[event.key];
    if (modifier !== undefined) {
      held.add(modifier);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onclose();
    }
  };

  const keyup = (event: KeyboardEvent) => {
    const modifier = MODIFIER_NAMES[event.key];
    if (modifier !== undefined) {
      held.delete(modifier);
    }
  };

  const toggle = (modifier: Modifier) => {
    if (pinned.has(modifier)) {
      pinned.delete(modifier);
    } else {
      pinned.add(modifier);
    }
  };

  const focusout = (event: FocusEvent) => {
    const to = event.relatedTarget;
    if (!(to instanceof Node && event.currentTarget instanceof Node && event.currentTarget.contains(to))) {
      held.clear();
      onclose();
    }
  };

  const COLORS: Readonly<Record<Group, string>> = {
    Apps: "#a6e3a1",
    Desktop: "#f9e2af",
    Focus: "#89b4fa",
    Move: "#fab387",
    Windows: "#f38ba8",
    Workspaces: "#cba6f7",
  };

  const isPicked = (binding: Binding | undefined) => binding !== undefined && binding === picked;
</script>

<div
  class="explorer"
  role="dialog"
  aria-label="Keybindings"
  tabindex="-1"
  onkeydown={keydown}
  onkeyup={keyup}
  onfocusout={focusout}
>
  <header>
    {#each MODIFIERS as modifier (modifier)}
      <button
        class="modifier"
        class:on={modifiers.has(modifier)}
        aria-pressed={pinned.has(modifier)}
        tabindex="-1"
        onclick={() => toggle(modifier)}
      >
        {modifier}
      </button>
    {/each}
    <input bind:this={input} bind:value={query} placeholder="Search, or hold a modifier" spellcheck="false" />
  </header>

  <p class="picked" aria-live="polite">
    {#if picked}
      <kbd>{shownChord(picked.chord)}</kbd>
      <span style:color={COLORS[picked.group]}>{picked.label}</span>
    {:else}
      Hold Meta, Shift, Ctrl or Alt, or press a chord, to see what it does.
    {/if}
  </p>

  <div class="keyboard">
    {#each KEYBOARD as keys, index (index)}
      <div class="row">
        {#each keys as { key, width = 1 } (key)}
          {@const binding = bound.get(key)}
          {@const modifier = MODIFIER_KEYS[key]}
          <button
            class="key"
            class:bound={binding !== undefined}
            class:held={modifier !== undefined && modifiers.has(modifier)}
            class:picked={isPicked(binding)}
            style:--width={width}
            style:--color={binding === undefined ? undefined : COLORS[binding.group]}
            title={binding?.label}
            tabindex="-1"
            onpointerenter={() => {
              if (binding !== undefined) {
                picked = binding;
              }
            }}
            onclick={() => {
              if (modifier !== undefined) {
                toggle(modifier);
              }
            }}
          >
            <span class="cap">{capOf(key, shownKey)}</span>
            {#if binding}<span class="what">{binding.label}</span>{/if}
          </button>
        {/each}
      </div>
    {/each}
  </div>

  <ul class="list">
    {#each listed as binding (binding.chord)}
      <li>
        <button
          class:picked={isPicked(binding)}
          tabindex="-1"
          onpointerenter={() => (picked = binding)}
          onclick={() => {
            const parts = partsOf(binding.chord);
            pinned.clear();
            for (const modifier of parts.modifiers) {
              pinned.add(modifier);
            }
            picked = binding;
          }}
        >
          <kbd>{shownChord(binding.chord)}</kbd>
          <span class="label">{binding.label}</span>
          <span class="group" style:color={COLORS[binding.group]}>{binding.group}</span>
        </button>
      </li>
    {:else}
      <li class="none">Nothing bound matches.</li>
    {/each}
  </ul>
</div>

<style>
  .explorer {
    /* Every row is 15 keys wide, with up to 14 gaps. */
    --unit: min(44px, calc((100vw - 132px) / 15));
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(calc(var(--unit) * 15 + 100px), calc(100vw - 32px));
    max-height: calc(100vh - 64px);
    padding: 14px;
    translate: -50% -50%;
    border: 2px solid #74c7ec;
    border-radius: 10px;
    background: #1e1e2e;
    box-shadow: 0 12px 48px #000c;
    box-sizing: border-box;
    font:
      13px "Hack Nerd Font",
      monospace;
    color: #cdd6f4;
    outline: none;
  }

  header {
    display: flex;
    gap: 6px;
  }

  button {
    border: 0;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .modifier {
    padding: 4px 10px;
    border-radius: 6px;
    background: #313244;
  }

  .modifier.on {
    background: #74c7ec;
    color: #1e1e2e;
  }

  input {
    flex: 1;
    padding: 4px 10px;
    border: 1px solid #45475a;
    border-radius: 6px;
    background: #181825;
    color: inherit;
    font: inherit;
    outline: none;
  }

  .picked {
    display: flex;
    gap: 10px;
    align-items: center;
    min-height: 24px;
    margin: 0;
    color: #7f849c;
  }

  kbd {
    padding: 1px 6px;
    border: 1px solid #45475a;
    border-radius: 4px;
    background: #181825;
    color: #cdd6f4;
    font: inherit;
    white-space: nowrap;
  }

  .keyboard {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: none;
  }

  .row {
    display: flex;
    gap: 4px;
  }

  .key {
    display: flex;
    flex: none;
    flex-direction: column;
    justify-content: space-between;
    width: calc(var(--unit) * var(--width) + 4px * (var(--width) - 1));
    height: var(--unit);
    padding: 3px 4px;
    border: 1px solid #313244;
    border-radius: 6px;
    background: #181825;
    text-align: left;
    overflow: hidden;
  }

  .key.bound {
    border-color: var(--color);
    background: color-mix(in srgb, var(--color) 18%, #181825);
  }

  .key.held {
    background: #74c7ec;
    color: #1e1e2e;
  }

  .key.picked {
    background: color-mix(in srgb, var(--color) 45%, #181825);
  }

  .cap {
    font-weight: bold;
  }

  .what {
    overflow: hidden;
    font-size: 9px;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .list {
    flex: 1;
    min-height: 96px;
    margin: 0;
    padding: 0;
    list-style: none;
    overflow-y: auto;
  }

  .list button {
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
    padding: 4px 8px;
    border-radius: 6px;
    background: transparent;
    text-align: left;
  }

  .list button.picked {
    background: #313244;
  }

  .label {
    flex: 1;
  }

  .group {
    font-size: 11px;
  }

  .none {
    padding: 4px 8px;
    color: #7f849c;
  }
</style>
