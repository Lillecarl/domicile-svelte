<!--
  The bar's bell, the history it opens, and the toasts. The compositor keeps
  the history; a toast that goes leaves its notification there. None show
  while locked, and what arrives then is only in the history.
-->
<script lang="ts">
  import type { Notification } from "@domicile-desktop/sdk/notification";
  import { BarItem } from "@domicile-svelte/bar";
  import { useDomicile, watch } from "@domicile-svelte/svelte";
  import { untrack } from "svelte";

  import Card from "./Card.svelte";
  import { arrivals, keyOf, toastMs, toasts, unread } from "./toasting";

  const {
    onclose,
  }: {
    /** The keyboard may have come to the shell: hand it back. */
    onclose?: () => void;
  } = $props();

  const { notifications, session, windows } = useDomicile();
  const list = watch(notifications, "change", () => notifications.list);
  const locked = watch(session, "lockchange", () => session.locked !== false);

  const MOST = 5;
  const PAUSED = "notifications.paused";
  const SEEN = "notifications.seen";

  // A reloaded shell keeps these.
  let paused = $state(localStorage.getItem(PAUSED) !== null);
  let seen = $state(Number(localStorage.getItem(SEEN) ?? 0));
  let open = $state(false);
  let up = $state<readonly string[]>([]);

  let before: readonly Notification[] | undefined;
  $effect(() => {
    const listed = list.current;
    if (listed === undefined) {
      return;
    }
    const fresh = arrivals(before, listed);
    before = listed;
    untrack(() => {
      if (!locked.current && !open) {
        up = [...up, ...fresh.filter((each) => toasts(each, paused)).map(keyOf)];
      }
    });
  });

  $effect(() => {
    if (locked.current) {
      up = [];
      open = false;
    }
  });

  // Read while the history is open, later ones too.
  $effect(() => {
    if (open) {
      const latest = Math.max(0, ...(list.current ?? []).map(({ time }) => time));
      if (latest > untrack(() => seen)) {
        seen = latest;
        localStorage.setItem(SEEN, String(latest));
      }
    }
  });

  const history = $derived((list.current ?? []).toReversed());
  const shown = $derived(history.filter((each) => up.includes(keyOf(each))).slice(0, MOST));
  const count = $derived(unread(list.current ?? [], seen));
  const label = $derived(
    ["Notifications", ...(count === 0 ? [] : [`${count} unread`]), ...(paused ? ["paused"] : [])].join(", "),
  );

  const hide = (key: string) => {
    up = up.filter((each) => each !== key);
  };
  const shut = () => {
    open = false;
    onclose?.();
  };
  /** Open the history, or close it. */
  export const toggle = () => {
    if (open) {
      shut();
    } else {
      open = true;
      up = [];
    }
  };
  const pause = () => {
    paused = !paused;
    if (paused) {
      localStorage.setItem(PAUSED, "");
    } else {
      localStorage.removeItem(PAUSED);
    }
  };

  let bell = $state<HTMLElement>();
  let panel = $state<HTMLElement | null>();
  $effect(() => {
    if (panel === undefined || panel === null) {
      return;
    }
    const box = panel;
    windows.focusShell();
    box.focus();
    const outside = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && !box.contains(target) && bell?.contains(target) !== true) {
        shut();
      }
    };
    // A press in a webview reaches this page only as its focus.
    const focused = (event: Event) => {
      if (event.target instanceof Element && event.target.localName === "webview") {
        shut();
      }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", focused);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", focused);
    };
  });
</script>

<span class="bell" bind:this={bell}>
  <BarItem title={label} onclick={toggle}>
    <span aria-label={label}>{paused ? "\u{f009b}" : "\u{f009a}"}</span>
    {#if count > 0}<span class="count">{count}</span>{/if}
  </BarItem>
</span>

{#if open}
  <div
    class="panel history"
    role="dialog"
    aria-label="Notifications"
    tabindex="-1"
    bind:this={panel}
    onkeydown={(event) => event.key === "Escape" && shut()}
  >
    <header>
      <span class="title">Notifications</span>
      <button type="button" onclick={pause}>{paused ? "Resume" : "Pause"}</button>
      <button
        type="button"
        disabled={history.length === 0}
        onclick={() => notifications.dismiss(history.map(({ id }) => id))}
      >
        Clear all
      </button>
    </header>
    {#each history as notification (keyOf(notification))}
      <Card
        {notification}
        closeLabel="Clear"
        onclose={() => notifications.dismiss([notification.id])}
        onpress={shut}
        ontyped={() => panel?.focus()}
      />
    {:else}
      <p>Nothing here.</p>
    {/each}
  </div>
{:else if shown.length > 0}
  <div class="panel" role="status">
    {#each shown as notification (keyOf(notification))}
      {@const key = keyOf(notification)}
      <Card
        {notification}
        lifetime={toastMs(notification)}
        closeLabel="Hide"
        onexpire={() => hide(key)}
        onclose={() => {
          hide(key);
          onclose?.();
        }}
        onpress={() => {
          hide(key);
          onclose?.();
        }}
        ontyped={() => onclose?.()}
      />
    {/each}
  </div>
{/if}

<style>
  .bell {
    display: inline-flex;
  }

  .count {
    padding: 0 5px;
    border-radius: 8px;
    background: #f38ba8;
    color: #1e1e2e;
    font-size: 10px;
    line-height: 14px;
  }

  .panel {
    position: fixed;
    top: calc(var(--bar-height, 32px) + 8px);
    right: 8px;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(400px, calc(100vw - 16px));
    max-height: calc(100vh - var(--bar-height, 32px) - 16px);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #45475a transparent;
    white-space: normal;
    user-select: text;
    filter: drop-shadow(0 4px 12px #0008);
  }

  .history {
    padding: 10px;
    border: 1px solid #45475a;
    border-radius: 10px;
    background: #181825;
    box-sizing: border-box;
    outline: none;
  }

  header {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .title {
    flex: 1;
    font-weight: bold;
  }

  header button {
    padding: 3px 10px;
    border: 0;
    border-radius: 6px;
    background: #313244;
    color: inherit;
    font: inherit;
  }

  header button:disabled {
    opacity: 0.5;
  }

  p {
    margin: 0;
    color: #7f849c;
  }
</style>
