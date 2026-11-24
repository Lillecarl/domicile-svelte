<!-- One chart, drawn by uPlot. -->
<script lang="ts">
  import uPlot from "uplot";

  import { format } from "./format";
  import { type Column, stack, type Track } from "./history";

  const {
    track,
    times,
    start,
    version,
  }: {
    track: Track;
    times: readonly number[];
    /** The first sample to draw. */
    start: number;
    /** Grows with each sample: the columns are changed in place. */
    version: number;
  } = $props();

  const COLORS = [
    "#89b4fa",
    "#a6e3a1",
    "#f9e2af",
    "#f38ba8",
    "#cba6f7",
    "#94e2d5",
    "#fab387",
    "#74c7ec",
    "#f5c2e7",
    "#b4befe",
    "#eba0ac",
    "#89dceb",
    "#f5e0dc",
    "#f2cdcd",
  ];
  const HEIGHT = 150;
  // The steps of a bytes axis.
  const POWERS = Array.from({ length: 50 }, (_each, power) => 2 ** power);

  // Series that were never more than zero, such as an unplugged fan's, are left out.
  const names = $derived.by(() => {
    void version;
    const all = [...track.columns.keys()];
    const active = all.filter((name) => track.active.has(name));
    return active.length > 0 ? active : all;
  });
  const shape = $derived(names.join("\n"));

  let raw: Column[] = [];
  const data = (): uPlot.AlignedData => {
    raw = names.map((name) => (track.columns.get(name) ?? []).slice(start));
    return [times.slice(start), ...(track.chart.stacked === true ? stack(raw) : raw)];
  };

  const options = (width: number): uPlot.Options => {
    const { unit, stacked, max } = track.chart;
    const axis = { stroke: "#a6adc8", grid: { stroke: "#31324480", width: 1 }, ticks: { show: false } };
    const font = '10px "Hack Nerd Font", monospace';
    return {
      width,
      height: HEIGHT,
      cursor: { sync: { key: "monitor" }, drag: { x: false, y: false }, points: { size: 5 } },
      scales: {
        y: {
          range: (_plot, low, high) => {
            if (max !== undefined) {
              return [0, max];
            }
            // Zero-based unless it cannot show a change, as with a voltage.
            const base = unit === "celsius" || unit === "volts" ? (low ?? 0) - 1 : 0;
            return [unit === "volts" ? Math.max(0, (low ?? 0) * 0.95) : Math.max(0, base), (high ?? 0) * 1.1 || 1];
          },
        },
      },
      axes: [
        { ...axis, font, size: 24, space: 70, values: "{HH}:{mm}:{ss}" },
        {
          ...axis,
          font,
          size: 72,
          space: 28,
          ...(unit.startsWith("bytes") ? { incrs: POWERS } : {}),
          values: (_plot, splits) => splits.map((value) => format(value, unit)),
        },
      ],
      series: [
        { label: "time", value: "{HH}:{mm}:{ss}" },
        ...names.map((label, index): uPlot.Series => {
          const color = COLORS[index % COLORS.length] ?? "#cdd6f4";
          return {
            label,
            stroke: color,
            width: 1.25,
            points: { show: false },
            ...(stacked === true ? { fill: `${color}40` } : {}),
            value: (_plot, _value, _series, at) => {
              const value = at === null ? null : raw[index]?.[at];
              return value === null || value === undefined ? "–" : format(value, unit);
            },
          };
        }),
      ],
      // Each band fills down to the series under it, not to zero.
      bands:
        stacked === true
          ? names.slice(1).map((_name, index) => ({ series: [index + 2, index + 1] as [number, number] }))
          : [],
    };
  };

  let host = $state<HTMLElement>();
  let plot: uPlot | undefined;
  let drawn = "";
  /** The newest values, unless the pointer picks a moment. */
  const latest = (drawing: uPlot) => {
    if ((drawing.cursor.left ?? -1) < 0) {
      drawing.setLegend({ idx: Math.max(0, times.length - start - 1) }, false);
    }
  };

  $effect(() => {
    void version;
    if (host === undefined) {
      return;
    }
    if (plot === undefined || drawn !== shape) {
      plot?.destroy();
      plot = new uPlot(options(host.clientWidth), data(), host);
      drawn = shape;
    } else {
      plot.setData(data());
    }
    latest(plot);
  });

  $effect(() => {
    if (host === undefined) {
      return;
    }
    const sized = new ResizeObserver(([entry]) => {
      if (entry !== undefined && plot !== undefined && entry.contentRect.width > 0) {
        plot.setSize({ width: entry.contentRect.width, height: HEIGHT });
      }
    });
    sized.observe(host);
    return () => sized.disconnect();
  });

  $effect(() => () => {
    plot?.destroy();
    plot = undefined;
  });
</script>

<figure>
  <figcaption>{track.chart.title}</figcaption>
  <div bind:this={host}></div>
</figure>

<style>
  figure {
    min-width: 0;
    margin: 0;
    padding: 8px;
    border-radius: 8px;
    background: #1e1e2e;
  }

  figcaption {
    padding-bottom: 4px;
    font-weight: bold;
  }

  figure :global(.u-legend) {
    display: flex;
    flex-wrap: wrap;
    gap: 0 12px;
    max-height: 84px;
    overflow-y: auto;
    text-align: left;
    font-size: 11px;
  }

  figure :global(.u-legend tbody) {
    display: contents;
  }

  figure :global(.u-legend th),
  figure :global(.u-legend td) {
    padding: 1px 2px;
    font-weight: normal;
  }

  figure :global(.u-legend .u-value) {
    font-variant-numeric: tabular-nums;
    color: #a6adc8;
  }
</style>
