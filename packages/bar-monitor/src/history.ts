import type { Chart, Sample } from "./metrics";

export type Column = (number | null)[];
export type Track = {
  chart: Chart;
  /** By series name, each as long as the times. */
  columns: Map<string, Column>;
  /** The series that were ever not zero. */
  active: Set<string>;
};

/** The samples of the last `seconds`, a column per series. */
export class History {
  readonly times: number[] = [];
  readonly tracks = new Map<string, Track>();

  constructor(
    private readonly seconds: number,
    /** Longer between samples than this, and the lines break. */
    private readonly gap: number,
  ) {}

  /** `time` is in seconds. */
  push(time: number, sample: Sample): void {
    const last = this.times.at(-1);
    // The clock was set back: the plots need times in order.
    if (last !== undefined && time <= last) {
      this.drop(this.times.length);
    } else if (last !== undefined && time - last > this.gap) {
      this.row(last + 0.001, new Map());
    }
    this.row(time, sample);
    // Some at a time: each takes moving what is left.
    if (time - (this.times[0] ?? time) > this.seconds * 1.05) {
      this.drop(this.times.findIndex((each) => time - each <= this.seconds));
    }
  }

  /** The first index within `seconds` of the last sample. */
  since(seconds: number): number {
    const last = this.times.at(-1) ?? 0;
    return Math.max(0, this.times.findIndex((each) => last - each <= seconds));
  }

  private row(time: number, sample: Sample): void {
    for (const [id, { chart, values }] of sample) {
      const track: Track = this.tracks.get(id) ?? { chart, columns: new Map(), active: new Set() };
      track.chart = chart;
      this.tracks.set(id, track);
      for (const [series, value] of values) {
        if (!track.columns.has(series)) {
          track.columns.set(series, new Array<null>(this.times.length).fill(null));
        }
        if (value !== 0) {
          track.active.add(series);
        }
      }
    }
    for (const [id, { columns }] of this.tracks) {
      const values = sample.get(id)?.values;
      for (const [series, column] of columns) {
        column.push(values?.get(series) ?? null);
      }
    }
    this.times.push(time);
  }

  private drop(samples: number): void {
    this.times.splice(0, samples);
    for (const [id, { columns, active }] of this.tracks) {
      for (const [series, column] of columns) {
        column.splice(0, samples);
        // A device that went away.
        if (column.every((value) => value === null)) {
          columns.delete(series);
          active.delete(series);
        }
      }
      if (columns.size === 0) {
        this.tracks.delete(id);
      }
    }
  }
}

/** Each column on top of those before it. */
export const stack = (columns: readonly Column[]): Column[] => {
  const sums: number[] = [];
  return columns.map((column) =>
    column.map((value, index) => {
      if (value === null) {
        return null;
      }
      sums[index] = (sums[index] ?? 0) + value;
      return sums[index];
    }),
  );
};
