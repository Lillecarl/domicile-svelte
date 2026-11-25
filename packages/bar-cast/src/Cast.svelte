<!--
  Casting to TVs. The panel lists the casts running and the TVs nearby: Extend
  makes a TV another monitor, Show… asks which window or monitor goes to it.
  TVs are looked for while the panel is open. Blanking waits while one is cast
  to.
-->
<script lang="ts">
  import { casting, CastMode, type Cast, type CastTarget, engineCast } from "@domicile-desktop/sdk/cast";
  import { BarItem } from "@domicile-svelte/bar";
  import { holdAwake, listen, useDomicile, watch } from "@domicile-svelte/svelte";
  import { untrack } from "svelte";

  const {
    onclose,
    oncasting,
  }: {
    /** The panel closed and gave up the keyboard: hand it back. */
    onclose?: () => void;
    /** Whether anything is cast now. */
    oncasting?: (casting: boolean) => void;
  } = $props();

  const domicile = useDomicile();
  const { dbus, googleCast, session, windows } = domicile;
  const desk = casting(domicile);
  const backend = engineCast(googleCast);
  const casts = listen<readonly Cast[]>((onValue) => desk.watch(onValue));
  const locked = watch(session, "lockchange", () => session.locked !== false);

  const running = $derived(casts.current ?? []);
  const isCasting = $derived(running.length > 0);
  const label = $derived(
    isCasting ? `Casting to ${running.map(({ target }) => target.name).join(", ")}` : "Cast to a TV",
  );

  $effect(() => {
    const on = isCasting;
    untrack(() => oncasting?.(on));
    return on ? holdAwake(dbus, "Casting to a TV") : undefined;
  });

  let open = $state(false);
  let targets = $state.raw<readonly CastTarget[]>([]);
  $effect(() => {
    if (open) {
      return backend.watchTargets((found) => {
        targets = found;
      });
    }
  });
  const idle = $derived(
    targets.filter(({ id }) => !running.some((cast) => cast.backend === backend && cast.target.id === id)),
  );

  let starting = $state<string>();
  let failed = $state<{ id: string; why: string }>();
  const start = async (target: CastTarget, mode: CastMode) => {
    starting = target.id;
    failed = undefined;
    if (mode === CastMode.Pick) {
      // The picker takes the keyboard, and asks about windows this covers.
      open = false;
    }
    // Shown again with the reason, which also takes the keyboard back up.
    const refused = (why: string) => {
      failed = { id: target.id, why };
      open = !locked.current;
    };
    try {
      const started = await desk.start(backend, target, mode);
      started.match({ Ok: () => undefined, Err: refused });
    } catch (error) {
      console.error("could not cast to", target.name, error);
      refused(String(error));
    } finally {
      starting = undefined;
    }
  };

  $effect(() => {
    if (locked.current) {
      open = false;
    }
  });

  const shut = () => {
    open = false;
    failed = undefined;
    onclose?.();
  };
  /** Open the panel, or close it. */
  export const toggle = () => {
    if (open) {
      shut();
    } else {
      open = true;
    }
  };

  let item = $state<HTMLElement>();
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
      if (target instanceof Node && !box.contains(target) && item?.contains(target) !== true) {
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

<span class="cast" bind:this={item}>
  <BarItem title={label} onclick={toggle}>
    <span class:live={isCasting} aria-label={label}>{isCasting ? "\u{f0119}" : "\u{f0118}"}</span>
  </BarItem>
</span>

{#if open}
  <div
    class="panel"
    role="dialog"
    aria-label="Cast to a TV"
    tabindex="-1"
    bind:this={panel}
    onkeydown={(event) => event.key === "Escape" && shut()}
  >
    <span class="title">Cast to a TV</span>
    {#each running as cast (cast)}
      <div class="row">
        <span class="name">
          {cast.target.name}
          <span class="detail">{cast.mode === CastMode.Extend ? "Another screen" : "Showing a window or screen"}</span>
        </span>
        <button type="button" onclick={cast.stop}>Stop</button>
      </div>
    {/each}
    {#each idle as target (target.id)}
      <div class="row">
        <span class="name">
          {target.name}
          {#if target.unreachable !== undefined}<span class="detail">{target.unreachable}</span>{/if}
          {#if failed?.id === target.id}<span class="why">{failed.why}</span>{/if}
        </span>
        {#if target.unreachable === undefined}
          <button
            type="button"
            title="Use the TV as another screen"
            disabled={starting !== undefined}
            onclick={() => void start(target, CastMode.Extend)}
          >
            {starting === target.id ? "Starting…" : "Extend"}
          </button>
          <button
            type="button"
            title="Pick a window or screen to show on the TV"
            disabled={starting !== undefined}
            onclick={() => void start(target, CastMode.Pick)}
          >
            Show…
          </button>
        {/if}
      </div>
    {:else}
      {#if !isCasting}<span class="detail">Looking for TVs…</span>{/if}
    {/each}
  </div>
{/if}

<style>
  .cast {
    display: inline-flex;
  }

  .live {
    color: #a6e3a1;
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
    padding: 10px;
    border: 1px solid #45475a;
    border-radius: 10px;
    background: #181825;
    color: #cdd6f4;
    font:
      13px "Hack Nerd Font",
      monospace;
    white-space: normal;
    box-sizing: border-box;
    overflow-y: auto;
    outline: none;
    filter: drop-shadow(0 4px 12px #0008);
  }

  .title {
    font-weight: bold;
  }

  .row {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 8px;
    border-radius: 8px;
    background: #1e1e2e;
  }

  .name {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .detail {
    color: #7f849c;
    font-size: 11px;
  }

  .why {
    color: #f9e2af;
    font-size: 11px;
  }

  button {
    padding: 3px 10px;
    border: 0;
    border-radius: 6px;
    background: #313244;
    color: inherit;
    font: inherit;
  }

  button:not(:disabled):hover {
    background: #45475a;
  }

  button:disabled {
    opacity: 0.5;
  }
</style>
