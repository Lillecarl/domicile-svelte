<!-- In place of a page that failed to load, or crashed, which the engine leaves blank. -->
<script lang="ts">
  import { useDomicile } from "@domicile-svelte/svelte";

  import type { Problem } from "./problem";

  const {
    problem,
    view,
  }: {
    problem: Problem;
    view: HTMLWebViewElement;
  } = $props();

  const { windows } = useDomicile();
  let box = $state<HTMLElement>();
  let open = $state(false);

  /** Take the keyboard. */
  export const focus = () => {
    windows.focusShell();
    (box?.querySelector("button") ?? box)?.focus();
  };
</script>

<section bind:this={box} tabindex="-1" aria-label={problem.title}>
  <h2>{problem.title}</h2>
  <p>{problem.message}</p>
  {#if problem.code}<p class="code">{problem.code}</p>{/if}
  <div class="answers">
    {#if problem.warning === undefined}
      <button type="button" class="yes" onclick={() => view.reload()}>Reload</button>
    {/if}
    {#if view.canGoBack}
      <button type="button" class:yes={problem.warning !== undefined} onclick={() => view.goBack()}>Go back</button>
    {/if}
    {#if problem.canProceed && !open}
      <button type="button" onclick={() => (open = true)}>Details</button>
    {/if}
  </div>
  {#if problem.canProceed && open}
    <p>{problem.warning}</p>
    <button type="button" class="risk" onclick={() => view.proceedPastWarning()}>Continue anyway</button>
  {/if}
</section>

<style>
  section {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
    justify-content: safe center;
    padding: 24px;
    background: #181825;
    color: #cdd6f4;
    font:
      14px "Hack Nerd Font",
      monospace;
    text-align: center;
    outline: none;
    overflow: auto;
  }

  h2,
  p {
    max-width: 40em;
    margin: 0;
    overflow-wrap: anywhere;
    text-wrap: balance;
  }

  .code {
    color: #7f849c;
    font-size: 12px;
  }

  .answers {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  button {
    padding: 4px 12px;
    border: 0;
    border-radius: 6px;
    background: #313244;
    color: inherit;
    font: inherit;
  }

  .yes {
    background: #74c7ec;
    color: #1e1e2e;
  }

  .risk {
    background: #f38ba8;
    color: #1e1e2e;
  }

  button:focus-visible {
    outline: 2px solid #cdd6f4;
  }
</style>
