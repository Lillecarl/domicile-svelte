import { expect, test } from "bun:test";

import { degrees, findSensor } from "./sensor";

const machine = (drivers: Record<string, string>) => ({
  names: async () => Object.keys(drivers),
  text: async (path: string) => `${drivers[path.split("/")[4] ?? ""] ?? ""}\n`,
});

test("the CPU's sensor is found by its driver", async () => {
  expect(await findSensor(machine({ hwmon0: "i915", hwmon1: "", hwmon4: "k10temp" }))).toBe(
    "/sys/class/hwmon/hwmon4/temp1_input",
  );
});

test("a machine with no CPU sensor has none", async () => {
  expect(await findSensor(machine({ hwmon0: "nvme" }))).toBeUndefined();
});

test("thousandths become degrees", () => {
  expect(degrees("71250\n")).toBe(71);
  expect(degrees("")).toBeUndefined();
});
