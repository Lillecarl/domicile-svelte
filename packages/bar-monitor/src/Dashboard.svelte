<!-- Meters of what is now, and a chart of everything sampled. -->
<script lang="ts">
  import css from "uplot/dist/uPlot.min.css?inline";

  import { duration, format } from "./format";
  import type { History, Track } from "./history";
  import Meter from "./Meter.svelte";
  import { type Chart, CORES, type Files, type Filesystem, FREQUENCY, inOrder, MEMORY, SWAP, TASKS } from "./metrics";
  import Plot from "./Plot.svelte";

  const {
    history,
    version,
    files,
    filesystems,
  }: {
    history: History;
    /** Grows with each sample: the history is changed in place. */
    version: number;
    files: Files;
    filesystems: readonly Filesystem[];
  } = $props();

  // Domicile's document has no <link> for a stylesheet.
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  $effect(() => {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    return () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((each) => each !== sheet);
    };
  });

  const SECTIONS: readonly Chart["section"][] = ["CPU", "Memory", "GPU", "Disks", "Network", "System", "Sensors"];
  const SPANS = [
    { label: "2 min", seconds: 120 },
    { label: "10 min", seconds: 600 },
    { label: "1 h", seconds: 3600 },
  ];
  let span = $state(600);

  const start = $derived.by(() => {
    void version;
    return history.since(span);
  });
  const sections = $derived.by(() => {
    void version;
    return SECTIONS.map((name) => ({
      name,
      tracks: [...history.tracks.values()]
        .filter(({ chart }) => chart.section === name)
        .sort((one, other) => inOrder(one.chart, other.chart)),
    })).filter(({ tracks }) => tracks.length > 0);
  });

  const newest = (id: string): Map<string, number> => {
    void version;
    const track = history.tracks.get(id);
    return new Map(
      [...(track?.columns ?? [])].flatMap(([name, column]) => {
        const value = column.at(-1);
        return value === null || value === undefined ? [] : [[name, value] as const];
      }),
    );
  };
  const cores = $derived(newest(CORES.id));
  const frequencies = $derived(newest(FREQUENCY.id));
  const filled = (id: string, parts: readonly string[]) => {
    const values = newest(id);
    return { used: parts.reduce((sum, part) => sum + (values.get(part) ?? 0), 0), of: maximum(id) };
  };
  const maximum = (id: string): number => {
    const track: Track | undefined = history.tracks.get(id);
    return track?.chart.max ?? 0;
  };
  const memory = $derived(filled(MEMORY.id, ["used", "shared"]));
  const swap = $derived(filled(SWAP.id, ["used"]));
  const ofBytes = ({ used, of }: { used: number; of: number }) => `${format(used, "bytes")} of ${format(of, "bytes")}`;

  const line = (path: string) => files.get(path)?.[0] ?? "";
  const facts = $derived([
    line("/proc/sys/kernel/hostname"),
    `Linux ${line("/proc/sys/kernel/osrelease")}`,
    `up ${duration(Number.parseFloat(line("/proc/uptime")) || 0)}`,
    `load ${line("/proc/loadavg").split(" ").slice(0, 3).join(" ")}`,
    `${newest(TASKS.id).get("threads") ?? 0} threads`,
  ]);
</script>

<header>
  <span class="facts">{facts.join(" · ")}</span>
  {#each SPANS as { label, seconds } (seconds)}
    <button type="button" class:chosen={span === seconds} aria-pressed={span === seconds} onclick={() => (span = seconds)}>
      {label}
    </button>
  {/each}
</header>

<div class="meters">
  {#each cores as [core, percent] (core)}
    {@const hertz = frequencies.get(core)}
    <Meter
      label={core}
      value={percent}
      of={100}
      text={`${percent.toFixed(0).padStart(3)}%${hertz === undefined ? "" : ` ${(hertz / 1e9).toFixed(2)} GHz`}`}
    />
  {/each}
</div>
<div class="meters wide">
  {#if memory.of > 0}<Meter label="Memory" value={memory.used} of={memory.of} text={ofBytes(memory)} />{/if}
  {#if swap.of > 0}<Meter label="Swap" value={swap.used} of={swap.of} text={ofBytes(swap)} />{/if}
  {#each filesystems as { source, target, used, size } (source)}
    <Meter label={target} value={used} of={size} text={ofBytes({ used, of: size })} />
  {/each}
</div>

{#each sections as { name, tracks } (name)}
  <h2>{name}</h2>
  <div class="charts">
    {#each tracks as track (track.chart.id)}
      <Plot {track} times={history.times} {start} {version} />
    {/each}
  </div>
{/each}

<style>
  header {
    position: sticky;
    top: -12px;
    z-index: 110;
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 4px 0;
    background: #181825;
  }

  .facts {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  button {
    padding: 3px 10px;
    border: 0;
    border-radius: 6px;
    background: #313244;
    color: inherit;
    font: inherit;
  }

  button.chosen {
    background: #74c7ec;
    color: #1e1e2e;
  }

  h2 {
    margin: 4px 0 0;
    font-size: 14px;
    color: #74c7ec;
  }

  .meters {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 4px 20px;
  }

  .wide {
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  }

  .charts {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(400px, 100%), 1fr));
    gap: 8px;
  }
</style>
