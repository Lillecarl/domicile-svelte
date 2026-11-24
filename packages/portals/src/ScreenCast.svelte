<!--
  What an application may record: a monitor, a window, or a browser window's
  page. Nothing is picked at first. Enter shares, Escape cancels.
-->
<script lang="ts">
  import { CastSource, CastSourceKind, PortalAnswer, type ScreenCastBody } from "@domicile-desktop/sdk/portal";
  import { useDomicile } from "@domicile-svelte/svelte";
  import { untrack } from "svelte";
  import { SvelteSet } from "svelte/reactivity";

  const {
    appId,
    to,
    body,
    answer,
  }: {
    appId: string;
    /** The TV it goes to, when the shell asked. */
    to?: string;
    body: ScreenCastBody;
    answer: (answer: PortalAnswer) => void;
  } = $props();

  const { browser, windows } = useDomicile();
  // A new request gets a new component, so its body never changes here. The
  // browser windows are read once too: a pick is an index into the list.
  const asked = untrack(() => body);

  type Offer = { icon: string; label: string; detail: string; source: CastSource };
  const offer = (source: CastSource): Offer[] => {
    switch (source.kind) {
      case CastSourceKind.Monitor:
        return [
          {
            icon: "🖥",
            label: source.name,
            detail: `${source.description} ${source.size[0]}×${source.size[1]}`.trim(),
            source,
          },
        ];
      case CastSourceKind.Window:
        return [{ icon: "🗔", label: source.title || source.appId || "Untitled window", detail: source.appId, source }];
      case CastSourceKind.BrowserWindow:
        return [{ icon: "🌐", label: source.title || "Untitled page", detail: "browser page", source }];
      case CastSourceKind.Region:
        return [];
    }
  };
  const offers: readonly Offer[] = [
    ...asked.sources,
    ...(asked.browserWindows
      ? untrack(() => browser.windows ?? []).map(({ id, title }) => CastSource.BrowserWindow({ id, title }))
      : []),
  ]
    .flatMap(offer)
    .toSorted((a, b) => Number(a.icon !== "🖥") - Number(b.icon !== "🖥"));

  const picked = new SvelteSet<number>();
  let dialog = $state<HTMLElement | null>();
  let at = $state(0);

  // A page has the keyboard until the shell takes it.
  $effect(() => {
    if (dialog !== undefined && dialog !== null) {
      windows.focusShell();
      dialog.focus();
    }
  });

  const pick = (index: number) => {
    at = index;
    const was = picked.has(index);
    if (!asked.multiple) {
      picked.clear();
    }
    if (was) {
      picked.delete(index);
    } else {
      picked.add(index);
    }
  };

  const share = () => {
    if (picked.size > 0) {
      answer(PortalAnswer.ScreenCast(offers.filter((_, index) => picked.has(index)).map(({ source }) => source)));
    }
  };

  const keydown = (event: KeyboardEvent) => {
    switch (event.key) {
      case "Escape":
        answer(PortalAnswer.Canceled());
        break;
      case "Enter":
        share();
        break;
      case "ArrowDown":
        at = Math.min(offers.length - 1, at + 1);
        break;
      case "ArrowUp":
        at = Math.max(0, at - 1);
        break;
      case " ":
        pick(at);
        break;
      default:
        return;
    }
    event.preventDefault();
  };
</script>

<div class="cover">
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div bind:this={dialog} class="cast" role="dialog" aria-label="Share your screen" tabindex="-1" onkeydown={keydown}>
    <header>
      {#if to === undefined}
        <strong>Share your screen</strong> <span>{appId || "An application"} asks to see it</span>
      {:else}
        <strong>Cast to {to}</strong>
      {/if}
    </header>
    <ul>
      {#each offers as { icon, label, detail }, index (index)}
        <li>
          <button
            type="button"
            tabindex="-1"
            class="row"
            class:chosen={index === at}
            class:picked={picked.has(index)}
            onclick={() => pick(index)}
          >
            <span class="icon">{picked.has(index) ? "✓" : icon}</span>
            <span class="name">{label}</span>
            <span class="detail">{detail}</span>
          </button>
        </li>
      {/each}
    </ul>
    <footer>
      <span class="note">Arrows move, Space picks</span>
      <button type="button" tabindex="-1" onclick={() => answer(PortalAnswer.Canceled())}>Cancel</button>
      <button type="button" tabindex="-1" class="accept" disabled={picked.size === 0} onclick={share}>Share</button>
    </footer>
  </div>
</div>

<style>
  .cover {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: grid;
    place-items: center;
    background: #0008;
  }

  .cast {
    display: flex;
    flex-direction: column;
    width: min(680px, calc(100vw - 32px));
    max-height: min(560px, calc(100vh - 64px));
    border: 2px solid #f38ba8;
    border-radius: 10px;
    background: #1e1e2e;
    box-shadow: 0 12px 48px #000c;
    overflow: hidden;
    outline: none;
    font: 14px "Hack Nerd Font", monospace;
    color: #cdd6f4;
  }

  header,
  footer {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 10px 12px;
  }

  header span,
  .note,
  .detail {
    color: #7f849c;
  }

  ul {
    flex: 1;
    margin: 0;
    padding: 4px;
    border-block: 1px solid #313244;
    list-style: none;
    overflow-y: auto;
  }

  button {
    padding: 4px 12px;
    border: 0;
    border-radius: 6px;
    background: #313244;
    color: inherit;
    font: inherit;
  }

  button:disabled {
    opacity: 0.5;
  }

  .row {
    display: flex;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    text-align: left;
  }

  .row.chosen {
    background: #313244;
  }

  .row.picked {
    color: #a6e3a1;
  }

  .icon {
    flex: none;
    width: 20px;
  }

  .name,
  .detail {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail {
    flex: 1;
    font-size: 12px;
    text-align: right;
  }

  .note {
    flex: 1;
  }

  .accept {
    background: #f38ba8;
    color: #1e1e2e;
  }
</style>
