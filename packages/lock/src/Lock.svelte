<!--
  The lock screen. The compositor enforces the lock; this only covers the
  desktop and takes the passphrase. It covers the desktop until the
  compositor says it is unlocked, so a reloaded shell shows nothing first.
-->
<script lang="ts">
  import { fromListening, listen, now, useDomicile, watch } from "@domicile-svelte/svelte";
  import { onDestroy } from "svelte";

  import { refusalText } from "./refusal";

  const {
    background,
    onunlock,
  }: {
    /**
     * An image URL, drawn whole in the middle on black, as swaylock's
     * `scaling = center` does; the clock and the field go below it.
     */
    background?: string;
    /** The desktop unlocked: give the keyboard back to a window. */
    onunlock?: () => void;
  } = $props();

  const { session, windows } = useDomicile();
  const locked = watch(session, "lockchange", () => session.locked);
  const refused = listen(fromListening(() => session.unlockRefusals(), "unlock refusals"));
  const clock = now();

  let input = $state<HTMLInputElement>();
  let passphrase = $state("");
  let pending = $state(false);
  let refusedAt = $state(0);

  // Refusals arrive before their lockchange.
  $effect(() => {
    if (refused.current !== undefined) {
      refusedAt = Date.now();
    }
  });

  // A lockchange that leaves the desktop locked while a passphrase is out is
  // its refusal. `locked` alone cannot tell: it stays true.
  $effect(() =>
    session.on("lockchange", () => {
      if (session.locked === true && pending) {
        pending = false;
        passphrase = "";
      }
    }),
  );

  let wasLocked = false;
  $effect(() => {
    const isLocked = locked.current === true;
    if (wasLocked && !isLocked) {
      passphrase = "";
      pending = false;
      onunlock?.();
    }
    wasLocked = isLocked;
  });

  // The page keeps every key while locked; the field must hold the focus.
  // Taken back after a focusin elsewhere finishes, as the docs say.
  let refocus: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    if (input === undefined) {
      return;
    }
    const field = input;
    windows.focusShell();
    field.focus();
    const away = (event: FocusEvent) => {
      if (event.target !== field) {
        clearTimeout(refocus);
        refocus = setTimeout(() => field.focus());
      }
    };
    document.addEventListener("focusin", away, true);
    return () => document.removeEventListener("focusin", away, true);
  });
  onDestroy(() => clearTimeout(refocus));

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (pending || passphrase === "") {
      return;
    }
    pending = true;
    session.unlock(passphrase);
  };

  const message = $derived(
    refused.current === undefined || refusedAt === 0
      ? undefined
      : refusalText(refused.current, (clock.current.getTime() - refusedAt) / 1000),
  );
</script>

{#if locked.current !== false}
  <div class="lock" class:pictured={background !== undefined} role="dialog" aria-label="Locked">
    {#if background !== undefined}
      <div class="picture" style:background-image={`url("${background}")`}></div>
    {/if}
    {#if locked.current === true}
      <time>{clock.current.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
      <p class="date">{clock.current.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</p>
      <form onsubmit={submit}>
        <input
          bind:this={input}
          bind:value={passphrase}
          type="password"
          autocomplete="current-password"
          placeholder={pending ? "Checking…" : "Passphrase"}
          readonly={pending}
          aria-label="Passphrase"
        />
      </form>
      <p class="message" aria-live="polite">{message ?? ""}</p>
    {/if}
  </div>
{/if}

<style>
  /* Opaque and over everything, the bar and native windows included. */
  .lock {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: #11111b;
    color: #cdd6f4;
    font-family: "Hack Nerd Font", monospace;
  }

  /* The picture takes the height the clock and the field leave. */
  .pictured {
    padding: 4vh 0;
    background: #000;
  }

  .picture {
    flex: 1;
    align-self: stretch;
    min-height: 0;
    margin-bottom: 2vh;
    background-position: center;
    background-repeat: no-repeat;
    background-size: contain;
  }

  time {
    font-size: 96px;
    font-weight: 300;
    line-height: 1;
  }

  /* Small and low, out of the picture's way. */
  .pictured time {
    font-size: 32px;
  }

  .pictured .date {
    margin-bottom: 8px;
    font-size: 14px;
  }

  .date {
    margin: 0 0 32px;
    color: #a6adc8;
    font-size: 18px;
  }

  input {
    width: 320px;
    padding: 10px 14px;
    border: 2px solid #313244;
    border-radius: 10px;
    background: #1e1e2e;
    color: inherit;
    font: inherit;
    font-size: 16px;
    text-align: center;
    outline: none;
  }

  input:focus {
    border-color: #74c7ec;
  }

  /* Read-only, not disabled, while the passphrase is checked: disabled, it
     would lose the focus. */
  input:read-only {
    opacity: 0.6;
  }

  .message {
    min-height: 1.5em;
    margin: 0;
    color: #f38ba8;
    font-size: 14px;
  }
</style>
