<!--
  Hidden while the config lists one keymap or none, as there is nothing to switch to.
  A switch, by click or by key, shows the new keymap's name at the pointer for a moment.
-->
<script lang="ts">
  import { KeymapChoice } from "@domicile-desktop/sdk/keymap-choice";
  import { BarItem } from "@domicile-svelte/bar";
  import { fromListening, listen, useDomicile } from "@domicile-svelte/svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { innerHeight, innerWidth } from "svelte/reactivity/window";
  import { fade } from "svelte/transition";

  import { near, type Point } from "./near";

  /** How long the name stays at the pointer after a switch. */
  const SHOWN_MS = 1200;

  const {
    onclicked,
  }: {
    /** A click took the keyboard to the bar: hand it back. */
    onclicked?: () => void;
  } = $props();

  const { keyboard, pointer } = useDomicile();
  const keymaps = listen(fromListening(() => keyboard.keymaps(), "the keymaps"));
  const listed = $derived(keymaps.current?.keymaps ?? []);
  const active = $derived(listed.find((keymap) => keymap.name === keymaps.current?.active));

  const reducedMotion = new MediaQuery("prefers-reduced-motion: reduce");
  let switched = $state<{ name: string; at: Point } | undefined>();
  let labelWidth = $state(0);
  let labelHeight = $state(0);
  const place = $derived(
    switched &&
      near(
        switched.at,
        { height: labelHeight, width: labelWidth },
        { height: innerHeight.current ?? 0, width: innerWidth.current ?? 0 },
      ),
  );

  // Not state: the effect compares against it without depending on it.
  let before: string | undefined;
  let hide: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const name = active?.name;
    if (name === undefined) {
      return;
    }
    const first = before === undefined;
    before = name;
    if (first) {
      return;
    }
    // Through a promise: an engine older than `position` throws, and only logs.
    Promise.resolve()
      .then(() => pointer.position())
      .then((at) => {
        if (at === undefined || active?.name !== name) {
          return;
        }
        switched = { at, name };
        clearTimeout(hide);
        hide = setTimeout(() => {
          switched = undefined;
        }, SHOWN_MS);
      })
      .catch((error: unknown) => console.error("could not find the pointer", error));
  });
  $effect(() => () => clearTimeout(hide));

  const failed = (error: unknown) => console.error("could not switch the keymap", error);

  /** Switch to the next of the config's keymaps. */
  export const next = () => {
    keyboard
      .selectKeymap(KeymapChoice.Next())
      .then((result) => result.match({ Err: failed, Ok: () => undefined }))
      .catch(failed);
  };

  const clicked = () => {
    next();
    onclicked?.();
  };
</script>

{#if listed.length > 1 && active !== undefined}
  <BarItem title={active.description} onclick={clicked}>⌨ {active.name}</BarItem>
{/if}

{#if switched && place}
  <div
    class="switched"
    role="status"
    style:left="{place.x}px"
    style:top="{place.y}px"
    bind:clientWidth={labelWidth}
    bind:clientHeight={labelHeight}
    transition:fade={{ duration: reducedMotion.current ? 0 : 150 }}
  >
    ⌨ {switched.name}
  </div>
{/if}

<style>
  .switched {
    position: fixed;
    z-index: 30;
    padding: 4px 10px;
    border: 1px solid #45475a;
    border-radius: 8px;
    background: #181825;
    color: #cdd6f4;
    font-weight: bold;
    white-space: nowrap;
    pointer-events: none;
    filter: drop-shadow(0 4px 12px #0008);
  }
</style>
