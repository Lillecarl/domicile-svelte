<!-- Hidden while the config lists one keymap or none, as there is nothing to switch to. -->
<script lang="ts">
  import { KeymapChoice } from "@domicile-desktop/sdk/keymap-choice";
  import { BarItem } from "@domicile-svelte/bar";
  import { fromListening, listen, useDomicile } from "@domicile-svelte/svelte";

  const {
    onclicked,
  }: {
    /** A click took the keyboard to the bar: hand it back. */
    onclicked?: () => void;
  } = $props();

  const { keyboard } = useDomicile();
  const keymaps = listen(fromListening(() => keyboard.keymaps(), "the keymaps"));
  const listed = $derived(keymaps.current?.keymaps ?? []);
  const active = $derived(listed.find((keymap) => keymap.name === keymaps.current?.active));

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
