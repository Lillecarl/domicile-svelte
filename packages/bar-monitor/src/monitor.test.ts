import { expect, test } from "bun:test";

import { duration, format } from "./format";
import { History, stack } from "./history";
import { count, cpuTemperature, parseFiles, parseFilesystems, type Sample, sampleOf } from "./metrics";

const at = (seconds: number, busy: number) =>
  count(
    parseFiles(
      [
        `/proc/uptime:${seconds}.00 9`,
        `/proc/stat:cpu  ${busy * 2} 0 0 0 0 0 0 0 ${busy} 0`,
        `/proc/stat:cpu0 ${busy} 0 0 0 0 0 0 0 0 0`,
        `/proc/stat:cpu1 ${busy} 0 0 0 0 0 0 0 0 0`,
        "/proc/meminfo:MemTotal:       100 kB",
        "/proc/meminfo:MemFree:         40 kB",
        "/proc/meminfo:Cached:          30 kB",
        "/proc/meminfo:Shmem:           10 kB",
        "/proc/net/dev:Inter-|   Receive",
        "/proc/net/dev: face |bytes",
        `/proc/net/dev:  eth0: ${seconds * 1000} 1 0 0 0 0 0 0 ${seconds * 10} 1 0 0 0 0 0 0`,
        `/sys/block/dm-1/stat: 1 0 ${seconds} 0 1 0 0 0 0 ${seconds * 500} 0`,
        "/sys/block/dm-1/dm/name:root",
        "/sys/class/hwmon/hwmon3/name:k10temp",
        "/sys/class/hwmon/hwmon3/temp1_label:Tctl",
        "/sys/class/hwmon/hwmon3/temp1_input:71250",
        "/sys/class/hwmon/hwmon3/temp2_input:-63000",
        `/sys/class/hwmon/hwmon0/energy1_input:${seconds * 45_000_000}`,
        `/sys/class/drm/card0/gt/gt0/rc6_residency_ms:${seconds * 250}`,
      ].join("\n"),
    ),
  );
const value = (sample: Sample, chart: string, series: string) => sample.get(chart)?.values.get(series);

test("counters become rates", () => {
  const sample = sampleOf(at(10, 100), at(12, 200));
  expect(value(sample, "cores", "0")).toBe(50);
  expect(value(sample, "cpu", "user")).toBe(25);
  expect(value(sample, "cpu", "guest")).toBe(25);
  expect(value(sample, "received", "eth0")).toBe(1000);
  expect(value(sample, "sent", "eth0")).toBe(10);
  expect(value(sample, "read", "root")).toBe(512);
  expect(value(sample, "busy", "root")).toBe(50);
  expect(value(sample, "energy hwmon0", "energy1")).toBe(45);
  expect(value(sample, "gpu", "card0 gt0 awake")).toBe(75);
});

test("the first sample has no rates, and a counter that went back has none", () => {
  expect(sampleOf(undefined, at(10, 100)).has("cores")).toBe(false);
  expect(sampleOf(at(10, 100), at(12, 50)).has("cores")).toBe(false);
});

test("gauges are read as they are, and an unconnected sensor is left out", () => {
  const sample = sampleOf(undefined, at(10, 0));
  expect(value(sample, "temp hwmon3", "Tctl")).toBe(71.25);
  expect(sample.get("temp hwmon3")?.values.size).toBe(1);
  expect(value(sample, "memory", "used")).toBe(30 * 1024);
  expect(value(sample, "memory", "cache")).toBe(20 * 1024);
  expect(sample.get("memory")?.chart.max).toBe(100 * 1024);
});

test("the CPU's sensor is found by its driver", () => {
  const files = (name: string) => parseFiles(`/sys/class/hwmon/hwmon3/name:${name}\n/sys/class/hwmon/hwmon3/temp1_input:71250`);
  expect(cpuTemperature(files("k10temp"))).toBe(71);
  expect(cpuTemperature(files("nvme"))).toBeUndefined();
});

test("a filesystem mounted twice is listed once", () => {
  expect(parseFilesystems("Filesystem Used 1B-blocks Mounted on\n/dev/a 5 10 /\n/dev/a 5 10 /home\n/dev/b 1 2 /my disk\n")).toEqual([
    { source: "/dev/a", used: 5, size: 10, target: "/" },
    { source: "/dev/b", used: 1, size: 2, target: "/my disk" },
  ]);
});

const one = (value: number, series = "a"): Sample =>
  new Map([["x", { chart: { id: "x", section: "CPU", title: "x", unit: "count" }, values: new Map([[series, value]]) }]]);

test("history keeps columns as long as the times, breaks at gaps and forgets", () => {
  const history = new History(10, 5);
  history.push(1, one(0));
  history.push(3, one(2, "b"));
  expect(history.tracks.get("x")?.columns).toEqual(new Map([["a", [0, null]], ["b", [null, 2]]]));
  expect(history.tracks.get("x")?.active).toEqual(new Set(["b"]));
  history.push(30, one(4));
  expect(history.times).toEqual([30]);
  expect(history.tracks.get("x")?.columns).toEqual(new Map([["a", [4]]]));
  history.push(32, one(5));
  history.push(39, one(6));
  expect(history.tracks.get("x")?.columns.get("a")).toEqual([4, 5, null, 6]);
  expect(history.since(8)).toBe(1);
  history.push(20, one(7));
  expect(history.times).toEqual([20]);
});

test("stacked columns add up", () => {
  expect(stack([[1, null], [2, 3]])).toEqual([[1, null], [3, 3]]);
});

test("values read in their unit", () => {
  expect(format(1536, "bytes/s")).toBe("1.5 KiB/s");
  expect(format(4_635_190_000, "hertz")).toBe("4.6 GHz");
  expect(format(0, "percent")).toBe("0%");
  expect(format(12_345, "/s")).toBe("12.3 k/s");
  expect(duration(156_361)).toBe("1 d 19:26");
});
