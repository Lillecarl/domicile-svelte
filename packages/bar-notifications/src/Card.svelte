<!-- One notification, in a toast or in the history. -->
<script lang="ts">
  import {
    DEFAULT_NOTIFICATION_ACTION,
    INLINE_REPLY_NOTIFICATION_ACTION,
    type Notification,
  } from "@domicile-desktop/sdk/notification";
  import { now, useDomicile } from "@domicile-svelte/svelte";
  import { onDestroy } from "svelte";

  import { ago } from "./toasting";

  const {
    notification,
    lifetime,
    closeLabel,
    onexpire,
    onclose,
    onpress,
    ontyped,
  }: {
    notification: Notification;
    /** How long it stays up; held while the pointer or the reply field is on it. */
    lifetime?: number;
    closeLabel: string;
    onexpire?: () => void;
    onclose: () => void;
    /** It, or one of its buttons, was pressed. */
    onpress: () => void;
    /** The reply field gave up the keyboard. */
    ontyped: () => void;
  } = $props();

  const { notifications, windows } = useDomicile();
  const clock = now(30_000);
  const buttons = $derived(
    notification.actions.filter(
      ({ key }) => key !== DEFAULT_NOTIFICATION_ACTION && key !== INLINE_REPLY_NOTIFICATION_ACTION,
    ),
  );
  const reply = $derived(notification.actions.find(({ key }) => key === INLINE_REPLY_NOTIFICATION_ACTION));

  let hovered = $state(false);
  let typing = $state(false);
  let text = $state("");

  $effect(() => {
    if (lifetime !== undefined && !hovered && !typing) {
      const timer = setTimeout(() => onexpire?.(), lifetime);
      return () => clearTimeout(timer);
    }
  });

  onDestroy(() => {
    if (typing) {
      ontyped();
    }
  });

  const press = (key: string) => {
    notifications.invoke(notification.id, key);
    onpress();
  };
  const send = (event: SubmitEvent) => {
    event.preventDefault();
    if (text.trim() !== "") {
      notifications.reply(notification.id, text);
      onpress();
    }
  };
  const replyKey = (event: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.blur();
      ontyped();
    }
  };
</script>

{#snippet words()}
  {#if notification.icon !== undefined}<img src={notification.icon} alt="" />{/if}
  <span class="words">
    <span class="from">{notification.appName} · {ago(notification.time, clock.current)}</span>
    <span class="summary">{notification.summary}</span>
    {#if notification.body !== ""}<span class="body">{notification.body}</span>{/if}
  </span>
{/snippet}

<article
  class:critical={notification.urgency === "critical"}
  onpointerenter={() => (hovered = true)}
  onpointerleave={() => (hovered = false)}
>
  <div class="top">
    {#if notification.clickable}
      <button type="button" class="content" onclick={() => press(DEFAULT_NOTIFICATION_ACTION)}>{@render words()}</button>
    {:else}
      <div class="content">{@render words()}</div>
    {/if}
    <button type="button" class="close" title={closeLabel} aria-label={closeLabel} onclick={onclose}>✕</button>
  </div>
  {#if buttons.length > 0}
    <div class="actions">
      {#each buttons as { key, label } (key)}
        <button type="button" onclick={() => press(key)}>{label}</button>
      {/each}
    </div>
  {/if}
  {#if reply !== undefined}
    <form class="actions" onsubmit={send}>
      <input
        bind:value={text}
        placeholder={reply.label || "Reply"}
        onfocus={() => {
          typing = true;
          windows.focusShell();
        }}
        onblur={() => (typing = false)}
        onkeydown={replyKey}
      />
      <button type="submit" disabled={text.trim() === ""}>Send</button>
    </form>
  {/if}
</article>

<style>
  article {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border: 1px solid #45475a;
    border-left: 3px solid #74c7ec;
    border-radius: 8px;
    background: #1e1e2e;
    color: #cdd6f4;
    font: 13px "Hack Nerd Font", monospace;
  }

  article.critical {
    border-left-color: #f38ba8;
  }

  .top {
    display: flex;
    gap: 8px;
    align-items: start;
  }

  .content {
    flex: 1;
    display: flex;
    gap: 10px;
    min-width: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
  }

  img {
    flex: none;
    width: 36px;
    height: 36px;
    object-fit: contain;
  }

  .words {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .from {
    color: #7f849c;
    font-size: 11px;
  }

  .summary {
    font-weight: bold;
  }

  .body {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 6;
    line-clamp: 6;
    overflow: hidden;
    white-space: pre-line;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .actions input {
    flex: 1;
    min-width: 0;
  }

  .actions > *,
  .close {
    padding: 3px 10px;
    border: 0;
    border-radius: 6px;
    background: #313244;
    color: inherit;
    font: inherit;
  }

  .close {
    padding: 0 6px;
    background: none;
    color: #7f849c;
  }

  button:not(:disabled):hover {
    background: #45475a;
  }

  .content:hover {
    background: none !important;
  }

  button:disabled {
    opacity: 0.5;
  }
</style>
