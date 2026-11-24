<!-- Which application opens a file or an address. The one chosen last is first. -->
<script lang="ts">
  import { type AppChooserBody, PortalAnswer } from "@domicile-desktop/sdk/portal";

  import Frame from "./Frame.svelte";

  const {
    body,
    icon,
    answer,
  }: {
    body: AppChooserBody;
    /** An application's icon, by its desktop file id. */
    icon: (id: string) => string | undefined;
    answer: (answer: PortalAnswer) => void;
  } = $props();

  // The choices may change while this is up.
  const sorted = $derived(
    body.choices.toSorted(
      (a, b) => Number(b === body.lastChoice) - Number(a === body.lastChoice) || a.localeCompare(b),
    ),
  );
  let query = $state("");
  let wanted = $state<string>();
  const shown = $derived(sorted.filter((id) => id.toLowerCase().includes(query.toLowerCase())));
  const chosen = $derived(wanted !== undefined && shown.includes(wanted) ? wanted : shown[0]);
</script>

<Frame
  title={`Open ${body.filename ?? body.uri ?? body.contentType ?? "this"} with`}
  accept="Open"
  eager
  disabled={chosen === undefined}
  onaccept={() => chosen !== undefined && answer(PortalAnswer.AppChooser(chosen))}
  oncancel={() => answer(PortalAnswer.Canceled())}
>
  <input bind:value={query} placeholder="Search" spellcheck="false" />
  <ul>
    {#each shown as id (id)}
      <li>
        <button type="button" class:chosen={id === chosen} onclick={() => (wanted = id)}>
          <span class="icon">
            {#if icon(id) !== undefined}<img src={icon(id)} alt="" />{/if}
          </span>
          {id}
        </button>
      </li>
    {/each}
  </ul>
</Frame>

<style>
  ul {
    max-height: 300px;
    margin: 0;
    padding: 0;
    list-style: none;
    overflow-y: auto;
  }

  ul button {
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
    background: transparent;
    text-align: left;
  }

  ul button.chosen {
    background: #313244;
  }

  .icon,
  img {
    flex: none;
    width: 22px;
    height: 22px;
  }
</style>
