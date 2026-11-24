/** How a chart's values read. */
export type Unit = "percent" | "bytes" | "bytes/s" | "hertz" | "celsius" | "rpm" | "volts" | "amps" | "watts" | "/s" | "count";

export type Chart = {
  id: string;
  section: "CPU" | "Memory" | "GPU" | "Disks" | "Network" | "System" | "Sensors";
  title: string;
  unit: Unit;
  /** Series drawn on top of each other, adding up. */
  stacked?: boolean;
  /** The top of the axis, when it is known. */
  max?: number;
};

/** Every chart's values at one moment, by chart id then series. */
export type Sample = Map<string, { chart: Chart; values: Map<string, number> }>;

/** A file's lines, by path. */
export type Files = ReadonlyMap<string, readonly string[]>;

/** A count that only grows: its chart shows how fast. */
type Counter = { chart: Chart; series: string; count: number; value: (perSecond: number) => number };
type Gauge = { chart: Chart; series: string; value: number };
export type Counts = { uptime: number; counters: Map<string, Counter>; gauges: Gauge[] };

const FILES = [
  "/proc/uptime /proc/loadavg /proc/stat /proc/meminfo /proc/net/dev /proc/net/sockstat /proc/pressure/*",
  "/proc/sys/fs/file-nr /proc/sys/kernel/hostname /proc/sys/kernel/osrelease",
  "/sys/block/*/stat /sys/block/*/dm/name",
  "/sys/devices/system/cpu/cpu[0-9]*/cpufreq/scaling_cur_freq",
  "/sys/class/hwmon/*/name /sys/class/hwmon/*/*_label /sys/class/hwmon/*/*_input /sys/class/hwmon/*/*_average",
  "/sys/class/drm/card[0-9]/gt/gt*/rps_act_freq_mhz /sys/class/drm/card[0-9]/gt/gt*/rc6_residency_ms",
  "/sys/class/drm/card[0-9]/device/gpu_busy_percent /sys/class/drm/card[0-9]/device/mem_info_vram_used",
  "/sys/class/power_supply/*/capacity",
].join(" ");

/**
 * Prints every file as `path:line`, in one process: a read per file would be
 * some 200 calls a sample. Globbed each time, as devices come and go.
 */
export const SAMPLE = ["sh", "-c", `exec grep -sH '' ${FILES}`];

/** Apart from {@link SAMPLE}: a dead mount can hang it. */
export const FILESYSTEMS = [
  ..."df -l -B1 --output=source,used,size,target -x tmpfs -x devtmpfs -x efivarfs -x overlay -x ramfs".split(" "),
];

export const parseFiles = (text: string): Files => {
  const files = new Map<string, string[]>();
  for (const line of text.split("\n")) {
    const colon = line.indexOf(":");
    if (colon > 0) {
      const path = line.slice(0, colon);
      const lines = files.get(path) ?? [];
      lines.push(line.slice(colon + 1));
      files.set(path, lines);
    }
  }
  return files;
};

export type Filesystem = { source: string; used: number; size: number; target: string };

/** One per device: a btrfs device is mounted once per subvolume. */
export const parseFilesystems = (text: string): Filesystem[] => {
  const bySource = new Map<string, Filesystem>();
  for (const line of text.trim().split("\n").slice(1)) {
    const [source = "", used, size, ...target] = line.trim().split(/\s+/);
    if (Number(size) > 0 && !bySource.has(source)) {
      bySource.set(source, { source, used: Number(used), size: Number(size), target: target.join(" ") });
    }
  }
  return [...bySource.values()];
};

const CPU: Chart = { id: "cpu", section: "CPU", title: "CPU time", unit: "percent", stacked: true, max: 100 };
export const CORES: Chart = { id: "cores", section: "CPU", title: "Core usage", unit: "percent", max: 100 };
export const FREQUENCY: Chart = { id: "frequency", section: "CPU", title: "Core frequency", unit: "hertz" };
const LOAD: Chart = { id: "load", section: "CPU", title: "Load average", unit: "count" };
export const MEMORY: Chart = { id: "memory", section: "Memory", title: "Memory", unit: "bytes", stacked: true };
export const SWAP: Chart = { id: "swap", section: "Memory", title: "Swap", unit: "bytes" };
const GPU: Chart = { id: "gpu", section: "GPU", title: "Busy", unit: "percent", max: 100 };
const GPU_FREQUENCY: Chart = { id: "gpu-frequency", section: "GPU", title: "Frequency", unit: "hertz" };
const VRAM: Chart = { id: "vram", section: "GPU", title: "Memory", unit: "bytes" };
const READ: Chart = { id: "read", section: "Disks", title: "Read", unit: "bytes/s" };
const WRITTEN: Chart = { id: "written", section: "Disks", title: "Written", unit: "bytes/s" };
const OPERATIONS: Chart = { id: "operations", section: "Disks", title: "Operations", unit: "/s" };
const BUSY: Chart = { id: "busy", section: "Disks", title: "Busy", unit: "percent", max: 100 };
const RECEIVED: Chart = { id: "received", section: "Network", title: "Received", unit: "bytes/s" };
const SENT: Chart = { id: "sent", section: "Network", title: "Sent", unit: "bytes/s" };
const PACKETS: Chart = { id: "packets", section: "Network", title: "Packets", unit: "/s" };
const LOST: Chart = { id: "lost", section: "Network", title: "Errors and drops", unit: "/s" };
const SOCKETS: Chart = { id: "sockets", section: "Network", title: "Sockets", unit: "count" };
const PRESSURE: Chart = { id: "pressure", section: "System", title: "Pressure (some stalled)", unit: "percent" };
export const TASKS: Chart = { id: "tasks", section: "System", title: "Tasks", unit: "count" };
const RUNNING: Chart = { id: "running", section: "System", title: "Running and blocked", unit: "count" };
const EVENTS: Chart = { id: "events", section: "System", title: "Context switches and interrupts", unit: "/s" };
const FORKS: Chart = { id: "forks", section: "System", title: "Processes started", unit: "/s" };
const OPEN_FILES: Chart = { id: "files", section: "System", title: "Open files", unit: "count" };
const BATTERY: Chart = { id: "battery", section: "System", title: "Battery", unit: "percent", max: 100 };

const CHARTS = [
  ...[CPU, CORES, FREQUENCY, LOAD, MEMORY, SWAP, GPU, GPU_FREQUENCY, VRAM, READ, WRITTEN, OPERATIONS, BUSY],
  ...[RECEIVED, SENT, PACKETS, LOST, SOCKETS, PRESSURE, TASKS, RUNNING, EVENTS, FORKS, OPEN_FILES, BATTERY],
].map(({ id }) => id);

/** Sorts charts as listed above, then the sensors by chip. */
export const inOrder = (one: Chart, other: Chart): number => {
  const [first, second] = [CHARTS.indexOf(one.id), CHARTS.indexOf(other.id)];
  return first === -1 && second === -1 ? numerically(one.title, other.title) : first - second;
};

const same = (value: number) => value;
const numbers = (text: string) => (text.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
const numerically = (one: string, other: string) => one.localeCompare(other, undefined, { numeric: true });

/** What a hwmon file's prefix measures, and the kernel's units in one of ours. */
const SENSORS: Record<string, { title: string; unit: Unit; per: number }> = {
  temp: { title: "temperatures", unit: "celsius", per: 1000 },
  fan: { title: "fans", unit: "rpm", per: 1 },
  in: { title: "voltages", unit: "volts", per: 1000 },
  curr: { title: "currents", unit: "amps", per: 1000 },
  power: { title: "power", unit: "watts", per: 1_000_000 },
};

/** The kernel drivers of a CPU's own sensor: AMD's, then Intel's. */
const CPU_SENSORS = ["k10temp", "coretemp"];

/** Whole degrees Celsius of the CPU. */
export const cpuTemperature = (files: Files): number | undefined => {
  for (const [path, [name]] of files) {
    if (path.startsWith("/sys/class/hwmon/") && path.endsWith("/name") && CPU_SENSORS.includes(name ?? "")) {
      const [text] = files.get(path.replace(/name$/, "temp1_input")) ?? [];
      return text === undefined ? undefined : Math.round(Number(text) / 1000);
    }
  }
  return undefined;
};

export const count = (files: Files): Counts => {
  const counters = new Map<string, Counter>();
  const gauges: Gauge[] = [];
  const gauge = (chart: Chart, series: string, value: number | undefined) => {
    if (value !== undefined && Number.isFinite(value)) {
      gauges.push({ chart, series, value });
    }
  };
  const counter = (chart: Chart, series: string, counted: number | undefined, value: Counter["value"] = same) => {
    if (counted !== undefined && Number.isFinite(counted)) {
      counters.set(`${chart.id} ${series}`, { chart, series, count: counted, value });
    }
  };
  const lines = (path: string) => files.get(path) ?? [];
  const matching = (pattern: RegExp) =>
    [...files]
      .map(([path, [text = ""]]) => ({ found: pattern.exec(path), text }))
      .filter((each): each is { found: RegExpExecArray; text: string } => each.found !== null)
      .sort((one, other) => numerically(one.found[0], other.found[0]));

  const stat = new Map(lines("/proc/stat").map((line) => {
    const [key = "", ...rest] = line.split(/\s+/);
    return [key, rest.map(Number)];
  }));
  const cores = [...stat].filter(([key]) => /^cpu\d+$/.test(key));
  // In hundredths of a second, so a second's worth is percent already.
  const share = (perSecond: number) => Math.min(100, perSecond / Math.max(1, cores.length));
  const [user = 0, nice = 0, system = 0, , iowait = 0, irq = 0, softirq = 0, steal = 0, guest = 0, guestNice = 0] =
    stat.get("cpu") ?? [];
  // The kernel counts a guest's time in user and nice too.
  counter(CPU, "user", user - guest, share);
  counter(CPU, "nice", nice - guestNice, share);
  counter(CPU, "system", system, share);
  counter(CPU, "interrupts", irq + softirq, share);
  counter(CPU, "guest", guest + guestNice, share);
  counter(CPU, "steal", steal, share);
  counter(CPU, "I/O wait", iowait, share);
  for (const [core, [user = 0, nice = 0, system = 0, , , irq = 0, softirq = 0, steal = 0]] of cores) {
    counter(CORES, core.slice(3), user + nice + system + irq + softirq + steal, (each) => Math.min(100, each));
  }
  counter(EVENTS, "context switches", stat.get("ctxt")?.[0]);
  counter(EVENTS, "interrupts", stat.get("intr")?.[0]);
  counter(FORKS, "processes", stat.get("processes")?.[0]);
  gauge(RUNNING, "running", stat.get("procs_running")?.[0]);
  gauge(RUNNING, "blocked", stat.get("procs_blocked")?.[0]);

  for (const { found, text } of matching(/\/cpu(\d+)\/cpufreq\/scaling_cur_freq$/)) {
    gauge(FREQUENCY, found[1] ?? "", Number(text) * 1000);
  }

  const [one, five, fifteen, , threads] = numbers(lines("/proc/loadavg")[0] ?? "");
  gauge(LOAD, "1 min", one);
  gauge(LOAD, "5 min", five);
  gauge(LOAD, "15 min", fifteen);
  gauge(TASKS, "threads", threads);

  const memory = new Map(lines("/proc/meminfo").map((line) => {
    const [key = "", value] = line.split(":");
    return [key, Number.parseInt(value ?? "", 10) * 1024];
  }));
  if (memory.has("MemTotal")) {
    const of = (key: string) => memory.get(key) ?? 0;
    const total = of("MemTotal");
    const chart = { ...MEMORY, max: total };
    const cache = of("Cached") + of("SReclaimable") - of("Shmem");
    // Split as htop splits it.
    gauge(chart, "used", total - of("MemFree") - of("Buffers") - of("Cached") - of("SReclaimable"));
    gauge(chart, "shared", of("Shmem"));
    gauge(chart, "buffers", of("Buffers"));
    gauge(chart, "cache", cache);
    if (of("SwapTotal") > 0) {
      const swap = { ...SWAP, max: of("SwapTotal") };
      gauge(swap, "used", of("SwapTotal") - of("SwapFree") - of("SwapCached"));
      gauge(swap, "cached", of("SwapCached"));
    }
    if (of("Zswapped") > 0) {
      gauge({ ...SWAP, max: of("SwapTotal") }, "zswap", of("Zswapped"));
    }
  }

  for (const { found, text } of matching(/^\/sys\/block\/([^/]+)\/stat$/)) {
    const name = found[1] ?? "";
    if (!/^(loop|ram|sr)\d/.test(name)) {
      const device = lines(`/sys/block/${name}/dm/name`)[0] ?? name;
      const [reads, , readSectors = NaN, , writes = NaN, , writtenSectors = NaN, , , busyMs] = numbers(text);
      counter(READ, device, readSectors * 512);
      counter(WRITTEN, device, writtenSectors * 512);
      counter(OPERATIONS, device, (reads ?? NaN) + writes);
      counter(BUSY, device, busyMs, (each) => Math.min(100, each / 10));
    }
  }

  for (const line of lines("/proc/net/dev").slice(2)) {
    const [name = "", rest = ""] = line.trim().split(/:\s*/);
    if (name !== "lo") {
      const each = numbers(rest);
      const [bytes, packets = NaN, errors = NaN, drops = NaN] = each;
      const [sentBytes, sentPackets = NaN, sentErrors = NaN, sentDrops = NaN] = each.slice(8);
      counter(RECEIVED, name, bytes);
      counter(SENT, name, sentBytes);
      counter(PACKETS, name, packets + sentPackets);
      counter(LOST, name, errors + drops + sentErrors + sentDrops);
    }
  }
  for (const line of lines("/proc/net/sockstat")) {
    const [protocol, rest] = line.split(": inuse ");
    if (rest !== undefined && (protocol === "TCP" || protocol === "UDP")) {
      gauge(SOCKETS, protocol, numbers(rest)[0]);
    }
  }

  for (const { found } of matching(/^\/proc\/pressure\/(\w+)$/)) {
    const some = lines(found[0]).find((line) => line.startsWith("some "));
    const total = /total=(\d+)/.exec(some ?? "")?.[1];
    counter(PRESSURE, found[1] ?? "", total === undefined ? undefined : Number(total), (each) =>
      Math.min(100, each / 10_000),
    );
  }
  gauge(OPEN_FILES, "open", numbers(lines("/proc/sys/fs/file-nr")[0] ?? "")[0]);
  for (const { found, text } of matching(/^\/sys\/class\/power_supply\/([^/]+)\/capacity$/)) {
    gauge(BATTERY, found[1] ?? "", Number(text));
  }

  for (const { found, text } of matching(/\/(card\d)\/gt\/(gt\d+)\/rps_act_freq_mhz$/)) {
    gauge(GPU_FREQUENCY, `${found[1]} ${found[2]}`, Number(text) * 1_000_000);
  }
  // i915 counts the time asleep (RC6), in milliseconds; amdgpu says busy itself.
  for (const { found, text } of matching(/\/(card\d)\/gt\/(gt\d+)\/rc6_residency_ms$/)) {
    counter(GPU, `${found[1]} ${found[2]} awake`, Number(text), (each) => Math.max(0, 100 - each / 10));
  }
  for (const { found, text } of matching(/\/(card\d)\/device\/gpu_busy_percent$/)) {
    gauge(GPU, found[1] ?? "", Number(text));
  }
  for (const { found, text } of matching(/\/(card\d)\/device\/mem_info_vram_used$/)) {
    gauge(VRAM, found[1] ?? "", Number(text));
  }

  for (const { found, text } of matching(/^\/sys\/class\/hwmon\/(hwmon\d+)\/([a-z]+)(\d+)_(input|average)$/)) {
    const [, directory = "", kind = "", index = "", which] = found;
    const at = `/sys/class/hwmon/${directory}`;
    const chip = lines(`${at}/name`)[0] ?? directory;
    const label = lines(`${at}/${kind}${index}_label`)[0] ?? `${kind}${index}`;
    const value = Number(text);
    const measure = SENSORS[kind];
    // The directory too: two of a chip, such as two drives, share its name.
    const id = `${kind} ${directory}`;
    if (kind === "energy") {
      const chart: Chart = { id, section: "Sensors", title: `${chip}: power`, unit: "watts" };
      counter(chart, label, value, (each) => each / 1_000_000);
    } else if (measure !== undefined && !(kind === "temp" && (value <= 0 || value >= 127_000))) {
      // An unconnected temperature input reads zero or an end of its range.
      const chart: Chart = { id, section: "Sensors", title: `${chip}: ${measure.title}`, unit: measure.unit };
      gauge(chart, which === "average" ? `${label} average` : label, value / measure.per);
    }
  }

  return { uptime: numbers(lines("/proc/uptime")[0] ?? "")[0] ?? NaN, counters, gauges };
};

/** `now`'s gauges, and how fast its counters grew since `before`. */
export const sampleOf = (before: Counts | undefined, now: Counts): Sample => {
  const sample: Sample = new Map();
  const put = (chart: Chart, series: string, value: number) => {
    const entry = sample.get(chart.id) ?? { chart, values: new Map<string, number>() };
    entry.values.set(series, value);
    sample.set(chart.id, entry);
  };
  const seconds = before === undefined ? 0 : now.uptime - before.uptime;
  for (const [key, { chart, series, count, value }] of now.counters) {
    const earlier = before?.counters.get(key)?.count;
    // Less than before: the device was replaced, and counts from zero.
    if (seconds > 0 && earlier !== undefined && count >= earlier) {
      put(chart, series, value((count - earlier) / seconds));
    }
  }
  for (const { chart, series, value } of now.gauges) {
    put(chart, series, value);
  }
  return sample;
};
