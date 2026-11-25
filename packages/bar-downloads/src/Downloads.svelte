<!--
  The desk's downloads, shown while there are any. The panel lists them newest
  first: cancel one in progress, open a finished one or its folder.
-->
<script lang="ts">
  import { type Download, DownloadState } from "@domicile-desktop/sdk/desktop/downloads";
  import { BarItem } from "@domicile-svelte/bar";
  import { useDomicile, watch } from "@domicile-svelte/svelte";

  import { detail, fileName, folder, fraction } from "./progress";

  const {
    onclose,
  }: {
    /** The panel closed and gave up the keyboard: hand it back. */
    onclose?: () => void;
  } = $props();

  const { downloads, processes, session, windows } = useDomicile();
  const list = watch(downloads, "change", () => downloads.list ?? []);
  const locked = watch(session, "lockchange", () => session.locked !== false);

  const rows = $derived(list.current.toReversed());
  const running = $derived(rows.filter(({ state }) => state === DownloadState.InProgress));
  const done = $derived(fraction(running));
  const percent = $derived(done === undefined ? undefined : `${Math.floor(done * 100)}%`);
  const label = $derived(
    running.length === 0
      ? "Downloads"
      : [`Downloading ${running.length} file${running.length === 1 ? "" : "s"}`, percent]
          .filter((part) => part !== undefined)
          .join(", "),
  );

  let open = $state(false);
  let unopened = $state<{ id: string; why: string }>();

  const shut = () => {
    if (open) {
      open = false;
      unopened = undefined;
      onclose?.();
    }
  };
  /** Open the panel, or close it. */
  export const toggle = () => {
    if (open) {
      shut();
    } else if (rows.length > 0) {
      open = true;
    }
  };

  $effect(() => {
    if (locked.current) {
      open = false;
    } else if (rows.length === 0) {
      shut();
    }
  });

  const launch = async (id: string, path: string) => {
    unopened = undefined;
    const ran = await processes.run(["domicile", "open", "--which", path]);
    ran.match({
      Ok: ({ code, stdout }) => {
        if (code === 0 && stdout.trim() !== "") {
          shut();
          processes.launch(["domicile", "open", path]);
        } else {
          unopened = { id, why: "No app opens this file." };
        }
      },
      Err: (error) => {
        console.error("[downloads] what opens", path, error);
        unopened = { id, why: "Could not open this file." };
      },
    });
  };
  const show = ({ id }: Download, path: string) => {
    launch(id, path).catch((error: unknown) => console.error("[downloads] open", path, error));
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

{#if rows.length > 0}
  <span class="downloads" bind:this={item}>
    <BarItem title={label} onclick={toggle}>
      <span aria-label={label}>{"\u{f01da}"}</span>
      {#if percent !== undefined}<span>{percent}</span>{/if}
    </BarItem>
  </span>
{/if}

{#if open}
  <div
    class="panel"
    role="dialog"
    aria-label="Downloads"
    tabindex="-1"
    bind:this={panel}
    onkeydown={(event) => event.key === "Escape" && shut()}
  >
    <header>
      <span class="title">Downloads</span>
      <button type="button" disabled={running.length === rows.length} onclick={() => downloads.clear()}> Clear </button>
    </header>
    {#each rows as download (download.id)}
      {@const { id, path, receivedBytes, state, totalBytes } = download}
      <div class="row">
        <span class="name">
          {fileName(path)}
          {#if state === DownloadState.InProgress && totalBytes > 0}
            <progress value={receivedBytes} max={totalBytes}></progress>
          {/if}
          <span class="detail">{detail(download)}</span>
          {#if unopened?.id === id}<span class="why">{unopened.why}</span>{/if}
        </span>
        {#if state === DownloadState.InProgress}
          <button type="button" onclick={() => downloads.cancel(id)}>Cancel</button>
        {:else}
          {#if state === DownloadState.Complete}
            <button type="button" onclick={() => show(download, path)}>Open</button>
            <button type="button" onclick={() => show(download, folder(path))}>Folder</button>
          {/if}
          <button
            type="button"
            title="Take off the list; the file stays"
            aria-label="Remove {fileName(path)}"
            onclick={() => downloads.remove(id)}
          >
            ✕
          </button>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .downloads {
    display: inline-flex;
  }

  .panel {
    position: fixed;
    top: calc(var(--bar-height, 32px) + 8px);
    right: 8px;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(460px, calc(100vw - 16px));
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

  header {
    display: flex;
    align-items: center;
  }

  .title {
    flex: 1;
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
    gap: 2px;
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

  progress {
    appearance: none;
    width: 100%;
    height: 4px;
    border: 0;
  }

  progress::-webkit-progress-bar {
    border-radius: 2px;
    background: #313244;
  }

  progress::-webkit-progress-value {
    border-radius: 2px;
    background: #89b4fa;
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
