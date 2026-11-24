import type { Unit } from "./metrics";

const scaled = (value: number, step: number, names: readonly string[]): string => {
  let size = Math.abs(value);
  let index = 0;
  while (size >= step && index < names.length - 1) {
    size /= step;
    index += 1;
  }
  const digits = size >= 100 || index === 0 ? 0 : 1;
  return `${value < 0 ? "-" : ""}${size.toFixed(digits)} ${names[index]}`;
};

const BYTES = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];

const few = (value: number): string =>
  Math.abs(value) >= 10_000
    ? scaled(value, 1000, ["", "k", "M", "G"])
    : String(Number(value.toFixed(Math.abs(value) < 10 ? 2 : 0)));

export const format = (value: number, unit: Unit): string => {
  switch (unit) {
    case "percent":
      return `${value.toFixed(value < 10 && value !== 0 ? 1 : 0)}%`;
    case "bytes":
      return scaled(value, 1024, BYTES);
    case "bytes/s":
      return `${scaled(value, 1024, BYTES)}/s`;
    case "hertz":
      return scaled(value, 1000, ["Hz", "kHz", "MHz", "GHz"]);
    case "celsius":
      return `${value.toFixed(0)}°C`;
    case "rpm":
      return `${value.toFixed(0)} rpm`;
    case "volts":
      return `${value.toFixed(2)} V`;
    case "amps":
      return `${value.toFixed(2)} A`;
    case "watts":
      return `${value.toFixed(1)} W`;
    case "/s":
      return `${few(value)}/s`;
    case "count":
      return few(value);
  }
};

/** A count of seconds as days, hours and minutes. */
export const duration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const days = Math.floor(minutes / 1440);
  const clock = `${Math.floor((minutes % 1440) / 60)}:${String(minutes % 60).padStart(2, "0")}`;
  return days === 0 ? clock : `${days} d ${clock}`;
};
