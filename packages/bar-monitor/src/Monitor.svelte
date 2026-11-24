<!--
  The CPU's temperature, and the dashboard it opens. Samples all the time, so
  the dashboard opens with a history. The desktop runs no process while locked,
  which leaves a gap.
-->
<script lang="ts">
  import { BarItem } from "@domicile-svelte/bar";
  import { useDomicile, watch } from "@domicile-svelte/svelte";

  import Dashboard from "./Dashboard.svelte";
  import { History } from "./history";
  import {
    type Counts,
    count,
    cpuTemperature,
    type Files,
    FILESYSTEMS,
    type Filesystem,
    parseFiles,
    parseFilesystems,
    SAMPLE,
    sampleOf,
  } from "./metrics";

  const {
    every = 2000,
    keep = 3600,
    warm = 80,
    hot = 90,
    onclose,
  }: {
    /** Milliseconds between samples. */
    every?: number;
    /** Seconds of samples to keep. */
    keep?: number;
    warm?: number;
    hot?: number;
    /** The keyboard came to the shell: hand it back. */
    onclose?: () => void;
  } = $props();

  const { processes, session, windows } = useDomicile();
  const locked = watch(session, "lockchange", () => session.locked !== false);

  // svelte-ignore state_referenced_locally
  const history = new History(keep, (every / 1000) * 3);
  let version = $state(0);
  let files = $state.raw<Files>(new Map());
  let filesystems = $state.raw<readonly Filesystem[]>([]);
  let open = $state(false);
  const celsius = $derived(cpuTemperature(files));

  const failed = (what: string) => (error: unknown) => console.error(`could not read ${what}`, error);

  let before: Counts | undefined;
  const sample = async () => {
    const ran = await processes.run(SAMPLE);
    // Grep fails when any file does, and some always do.
    const text = ran.match({ Ok: ({ stdout }) => stdout, Err: () => "" });
    if (text !== "") {
      files = parseFiles(text);
      const now = count(files);
      history.push(Date.now() / 1000, sampleOf(before, now));
      before = now;
      version += 1;
    }
  };

  // Polled: the kernel tells nobody when a counter moves. The next waits for
  // the last, so a slow one never piles up.
  const poll = (read: () => Promise<void>, ms: number, what: string) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const step = async () => {
      await read().catch(failed(what));
      if (!stopped) {
        timer = setTimeout(() => void step(), ms);
      }
    };
    void step();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  };

  $effect(() => (locked.current ? undefined : poll(sample, every, "the counters")));

  $effect(() => {
    if (open) {
      return poll(
        async () => {
          const ran = await processes.run(FILESYSTEMS);
          filesystems = ran.match({ Ok: ({ stdout }) => parseFilesystems(stdout), Err: () => filesystems });
        },
        30_000,
        "the filesystems",
      );
    }
  });

  $effect(() => {
    if (locked.current) {
      open = false;
    }
  });

  const shut = () => {
    open = false;
    onclose?.();
  };
  /** Open the dashboard, or close it. */
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

<span class="monitor" bind:this={item}>
  <BarItem title="System monitor" onclick={toggle}>
    <span
      class="temperature"
      class:warm={celsius !== undefined && celsius >= warm}
      class:hot={celsius !== undefined && celsius >= hot}
    >
      {celsius === undefined ? "\u{f0379}" : `${celsius}°C`}
    </span>
  </BarItem>
</span>

{#if open}
  <div
    class="panel"
    role="dialog"
    aria-label="System monitor"
    tabindex="-1"
    bind:this={panel}
    onkeydown={(event) => event.key === "Escape" && shut()}
  >
    <Dashboard {history} {version} {files} {filesystems} />
  </div>
{/if}

<style>
  .monitor {
    display: inline-flex;
  }

  .temperature {
    font-variant-numeric: tabular-nums;
  }

  .warm {
    color: #f9e2af;
  }

  .hot {
    color: #f38ba8;
  }

  .panel {
    position: fixed;
    top: calc(var(--bar-height, 32px) + 8px);
    right: 8px;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(1400px, calc(100vw - 16px));
    max-height: calc(100vh - var(--bar-height, 32px) - 16px);
    padding: 12px;
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
</style>
