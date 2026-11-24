<!-- The chords an application would hold everywhere. An empty one stays unbound. -->
<script lang="ts">
  import { spelled } from "@domicile-desktop/sdk/own-keybindings";
  import { PortalAnswer, type ShortcutsBody } from "@domicile-desktop/sdk/portal";
  import { untrack } from "svelte";

  import Frame from "./Frame.svelte";

  const {
    appId,
    body,
    chords,
    answer,
  }: {
    appId: string;
    body: ShortcutsBody;
    /** The chords the shell holds itself. */
    chords: readonly string[];
    answer: (answer: PortalAnswer) => void;
  } = $props();

  const asked = untrack(() => body);
  const held = new Map([
    ...asked.taken.map(({ chord, appId: by }) => [spelled(chord), by] as const),
    ...untrack(() => chords).map((chord) => [spelled(chord), "the shell"] as const),
  ]);

  const check = (text: string): { chord?: string; problem?: string } => {
    const written = text.trim();
    if (written === "") {
      return {};
    }
    try {
      const chord = spelled(written);
      const by = held.get(chord);
      return by === undefined ? { chord } : { chord, problem: `Held by ${by}` };
    } catch (error) {
      return { problem: error instanceof Error ? error.message : String(error) };
    }
  };

  // What the application prefers is offered only when nothing else holds it.
  let texts = $state(
    asked.shortcuts.map(({ trigger }) => (trigger === undefined ? "" : check(trigger).problem ? "" : trigger)),
  );
  const checks = $derived(texts.map(check));
</script>

<Frame
  title={`${appId || "An application"} asks for shortcuts that work everywhere`}
  accept="Allow"
  disabled={checks.some(({ problem }) => problem !== undefined)}
  onaccept={() =>
    answer(
      PortalAnswer.GlobalShortcuts(asked.shortcuts.map(({ id }, index) => ({ id, trigger: checks[index]?.chord }))),
    )}
  oncancel={() => answer(PortalAnswer.Canceled())}
>
  {#each asked.shortcuts as { id, description }, index (id)}
    <label>{description || id} <input bind:value={texts[index]} placeholder="unbound" spellcheck="false" /></label>
    {#if checks[index]?.problem !== undefined}<p class="bad">{checks[index].problem}</p>{/if}
  {/each}
  <p class="note">Written as Meta+Shift+a</p>
</Frame>
