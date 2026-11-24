<!-- A question over the page it is about; the rest of the desktop stays usable. -->
<script lang="ts">
  import { useDomicile } from "@domicile-svelte/svelte";
  import { untrack } from "svelte";

  import type { Ask } from "./ask";

  const {
    ask,
    active,
    onlink,
    onanswered,
  }: {
    ask: Ask;
    /** Whether its window has the keyboard. */
    active: boolean;
    onlink: (url: string) => void;
    /** Answered: `answer` tells the page. */
    onanswered: (answer: () => void) => void;
  } = $props();

  const { windows } = useDomicile();
  let form = $state<HTMLFormElement>();

  // Keyed by question: one that changes while it is up keeps what is typed.
  let texts = $state(untrack(() => (ask.fields ?? []).map(({ value }) => value)));
  let wanted = $state(untrack(() => ask.picked));
  let ticked = $state(false);
  const choice = $derived(ask.choices?.some(({ value }) => value === wanted) === true ? wanted : undefined);

  // A click or key meant for the page must not answer.
  const HOLD_MS = 500;
  let read = $state(untrack(() => ask.grants !== true));
  $effect(() => {
    const timer = setTimeout(() => (read = true), HOLD_MS);
    return () => clearTimeout(timer);
  });
  const ready = $derived(read && (ask.choices === undefined || choice !== undefined));

  /** Take the keyboard. */
  export const focus = () => {
    windows.focusShell();
    const field = form?.querySelector<HTMLInputElement>("label.field input");
    if (field !== null && field !== undefined) {
      field.focus();
      field.select();
      return;
    }
    const [first, second] = ask.grants === true ? [".no", ".yes"] : [".yes:enabled", ".no"];
    const target = form?.querySelector<HTMLElement>(first) ?? form?.querySelector<HTMLElement>(second) ?? form;
    target?.focus();
  };
  $effect(() => {
    if (form !== undefined) {
      untrack(() => {
        if (active && ask.aside !== true) {
          focus();
        }
      });
    }
  });

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (ready && ask.yes !== undefined) {
      const answer = { texts: $state.snapshot(texts), choice: choice ?? 0, ticked };
      onanswered(() => ask.accept(answer));
    }
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && (ask.no !== undefined || ask.yes !== undefined)) {
      event.preventDefault();
      onanswered(() => ask.dismiss());
    }
  };
</script>

<div class="cover" class:aside={ask.aside}>
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <form bind:this={form} role="alertdialog" aria-label={ask.title} tabindex="-1" onsubmit={submit} onkeydown={keydown}>
    <header>
      {#if ask.icon}<img src={ask.icon} alt="" />{/if}
      <span>{ask.title}</span>
      {#if ask.aside && ask.no !== undefined}
        <button type="button" aria-label={ask.no} title={ask.no} onclick={() => onanswered(() => ask.dismiss())}>
          ✕
        </button>
      {/if}
    </header>
    {#if ask.message}<p class="message">{ask.message}</p>{/if}
    {#each ask.details ?? [] as detail, at (at)}<p class="detail">{detail}</p>{/each}
    {#each ask.fields ?? [] as field, at (at)}
      <label class="field">
        {field.label}
        <input
          type={field.kind}
          bind:value={texts[at]}
          aria-label={field.label || ask.title}
          autocomplete="off"
          spellcheck="false"
        />
      </label>
    {/each}
    {#if ask.choices !== undefined}
      <div class="choices">
        {#each ask.choices as each (each.value)}
          <label>
            <input type="radio" name="choice" value={each.value} bind:group={wanted} />
            {#if each.icon}<img src={each.icon} alt="" />{/if}
            <span>
              {each.label}{#if each.detail}<small>{each.detail}</small>{/if}
            </span>
          </label>
        {/each}
      </div>
    {/if}
    {#if ask.tick}<label><input type="checkbox" bind:checked={ticked} />{ask.tick}</label>{/if}
    {#if ask.note}
      <p class="note">
        {ask.note}
        {#each ask.links ?? [] as link (link.url)}
          <button type="button" class="link" onclick={() => onlink(link.url)}>{link.label}</button>
        {/each}
      </p>
    {/if}
    <footer>
      {#each ask.extra ?? [] as extra (extra.label)}
        <button type="button" onclick={() => onanswered(extra.run)}>{extra.label}</button>
      {/each}
      <span class="space"></span>
      {#if ask.no !== undefined && !ask.aside}
        <button type="button" class="no" onclick={() => onanswered(() => ask.dismiss())}>{ask.no}</button>
      {/if}
      {#if ask.yes !== undefined}<button type="submit" class="yes" disabled={!ready}>{ask.yes}</button>{/if}
    </footer>
  </form>
</div>

<style>
  .cover {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: grid;
    justify-items: center;
    align-items: start;
    padding: 24px 12px;
    background: #0008;
    overflow: hidden;
  }

  .aside {
    inset: 0 0 auto auto;
    padding: 8px;
    background: none;
  }

  .aside form {
    width: min(340px, 100%);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-sizing: border-box;
    width: min(480px, 100%);
    max-height: 100%;
    padding: 14px;
    border: 2px solid #74c7ec;
    border-radius: 10px;
    background: #1e1e2e;
    box-shadow: 0 12px 48px #000c;
    color: #cdd6f4;
    font:
      13px "Hack Nerd Font",
      monospace;
    outline: none;
    overflow-y: auto;
  }

  header {
    display: flex;
    gap: 8px;
    align-items: center;
    font-weight: bold;
    overflow-wrap: anywhere;
  }

  header span {
    flex: 1;
    min-width: 0;
  }

  img {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: contain;
  }

  p {
    margin: 0;
  }

  /* A page's own words keep their lines; many scroll. */
  .message {
    flex-shrink: 0;
    max-height: 40vh;
    overflow-y: auto;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .detail {
    flex-shrink: 0;
    color: #a6adc8;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .note,
  small {
    color: #a6adc8;
    font-size: 12px;
  }

  small {
    display: block;
  }

  label {
    display: flex;
    gap: 8px;
    align-items: center;
    overflow-wrap: anywhere;
  }

  .field {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }

  .field input {
    padding: 5px 8px;
    border: 0;
    border-radius: 6px;
    background: #313244;
    color: inherit;
    font: inherit;
  }

  .choices {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 240px;
    overflow-y: auto;
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .space {
    flex: 1;
  }

  button {
    padding: 4px 12px;
    border: 0;
    border-radius: 6px;
    background: #313244;
    color: inherit;
    font: inherit;
  }

  .link {
    padding: 0;
    background: none;
    color: #74c7ec;
    text-decoration: underline;
  }

  .yes {
    background: #74c7ec;
    color: #1e1e2e;
  }

  button:disabled {
    opacity: 0.5;
  }

  form :focus-visible {
    outline: 2px solid #cdd6f4;
  }
</style>
