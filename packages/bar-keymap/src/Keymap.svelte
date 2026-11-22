<!-- Hidden while the config lists one keymap or none, as there is nothing to switch to. -->
<script lang="ts">
  import { KeymapChoice } from "@domicile-desktop/sdk/keymap-choice";
  import { BarItem } from "@domicile-svelte/bar";
  import { fromListening, listen, useDomicile } from "@domicile-svelte/svelte";

  const { keyboard } = useDomicile();
  const keymaps = listen(fromListening(() => keyboard.keymaps(), "the keymaps"));
  const listed = $derived(keymaps.current?.keymaps ?? []);
  const active = $derived(listed.find((keymap) => keymap.name === keymaps.current?.active));

  const failed = (error: unknown) => console.error("could not switch the keymap", error);
  const next = () => {
    keyboard
      .selectKeymap(KeymapChoice.Next())
      .then((result) => result.match({ Err: failed, Ok: () => undefined }))
      .catch(failed);
  };
</script>

{#if listed.length > 1 && active !== undefined}
  <BarItem title={active.description} onclick={next}>⌨ {active.name}</BarItem>
{/if}
