<!-- What an agent may reach: the windows checked, or the whole desk. Nothing is checked at first. -->
<script lang="ts">
  import { type AgentBody, PortalAnswer } from "@domicile-desktop/sdk/portal";
  import { untrack } from "svelte";
  import { SvelteSet } from "svelte/reactivity";

  import Frame from "./Frame.svelte";

  const { body, answer }: { body: AgentBody; answer: (answer: PortalAnswer) => void } = $props();
  const asked = untrack(() => body);
  const current = asked.current;
  let desk = $state(current?.kind === "desk");
  let remember = $state(asked.remembered);
  const picked = new SvelteSet(current?.kind === "windows" ? current.windows.map(({ id }) => id) : []);
  const windows = $derived(asked.windows.filter(({ id }) => picked.has(id)));
</script>

<Frame
  title={current === undefined ? `${asked.agent} asks to use your desktop` : `What ${asked.agent} may use`}
  accept="Allow"
  danger
  disabled={!desk && windows.length === 0}
  onaccept={() => answer(desk ? PortalAnswer.Agent({ kind: "desk" }, remember) : PortalAnswer.Agent({ kind: "windows", windows }))}
  oncancel={() => answer(PortalAnswer.Canceled())}
>
  <p class="note">The agent names itself; nothing checks it.</p>
  <label>The whole desktop, with pointer and keyboard <input type="checkbox" bind:checked={desk} /></label>
  {#if desk}
    <label>Let it in without asking next time <input type="checkbox" bind:checked={remember} /></label>
  {:else}
    {#each asked.windows as { id, title, app } (id)}
      <label>
        <span>{title || app || id}</span>
        <input
          type="checkbox"
          checked={picked.has(id)}
          onchange={(event) => (event.currentTarget.checked ? picked.add(id) : picked.delete(id))}
        />
      </label>
    {/each}
  {/if}
</Frame>
