/** The values date, time and color inputs take, and the days of a calendar. A day is a UTC `Date`. */

const DAY_MS = 86_400_000;

const pad = (value: number, width = 2) => String(value).padStart(width, "0");

export const day = (year: number, month: number, date: number): Date => {
  // Date.UTC takes a year under 100 as 19xx.
  const made = new Date(Date.UTC(2000, month - 1, date));
  made.setUTCFullYear(year, month - 1, date);
  return made;
};

export const addDays = (from: Date, days: number): Date => new Date(from.getTime() + days * DAY_MS);

/** The same date `months` later, or the last of that month. */
export const addMonths = (from: Date, months: number): Date => {
  const first = day(from.getUTCFullYear(), from.getUTCMonth() + 1 + months, 1);
  const last = day(first.getUTCFullYear(), first.getUTCMonth() + 2, 0).getUTCDate();
  return addDays(first, Math.min(from.getUTCDate(), last) - 1);
};

/** Monday 0 to Sunday 6. */
const weekday = (of: Date): number => (of.getUTCDay() + 6) % 7;

/** The ISO 8601 week, which its Thursday places in a year. */
export const weekOf = (of: Date): { year: number; week: number } => {
  const thursday = addDays(of, 3 - weekday(of));
  const year = thursday.getUTCFullYear();
  return { year, week: Math.floor((thursday.getTime() - day(year, 1, 1).getTime()) / DAY_MS / 7) + 1 };
};

/** The month of `of` as whole weeks, Monday first. */
export const weeksOf = (of: Date): Date[][] => {
  const first = day(of.getUTCFullYear(), of.getUTCMonth() + 1, 1);
  const start = addDays(first, -weekday(first));
  const last = addDays(addMonths(first, 1), -1);
  const weeks = Math.ceil((weekday(first) + last.getUTCDate()) / 7);
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, at) => addDays(start, week * 7 + at)),
  );
};

export type Kind = "date" | "datetime-local" | "month" | "week";

/** The day `value` names, or none. */
export const parse = (kind: Kind, value: string): Date | undefined => {
  const [, year = "", rest = "", date = "1"] =
    (kind === "week" ? /^(\d{4,})-W(\d{2})$/u : /^(\d{4,})-(\d{2})(?:-(\d{2}))?(?:T|$)/u).exec(value) ?? [];
  if (year === "") {
    return undefined;
  }
  if (kind === "week") {
    // January 4th is always in week 1.
    const fourth = day(Number(year), 1, 4);
    const monday = addDays(fourth, (Number(rest) - 1) * 7 - weekday(fourth));
    return format("week", monday, "") === value ? monday : undefined;
  }
  const made = day(Number(year), Number(rest), Number(date));
  return made.getUTCMonth() + 1 === Number(rest) ? made : undefined;
};

/** `of` as an input's value. `time` only for `datetime-local`. */
export const format = (kind: Kind, of: Date, time: string): string => {
  const month = `${pad(of.getUTCFullYear(), 4)}-${pad(of.getUTCMonth() + 1)}`;
  switch (kind) {
    case "month":
      return month;
    case "week": {
      const { year, week } = weekOf(of);
      return `${pad(year, 4)}-W${pad(week)}`;
    }
    case "date":
      return `${month}-${pad(of.getUTCDate())}`;
    case "datetime-local":
      return `${month}-${pad(of.getUTCDate())}T${time}`;
  }
};

/** Whether the control takes `of`; a bound it cannot read bounds nothing. */
export const within = (kind: Kind, of: Date, min: string, max: string): boolean => {
  const [from, to] = [parse(kind, min), parse(kind, max)];
  return (from === undefined || of >= from) && (to === undefined || of <= to);
};

/** `"13:45"` or `"13:45:10"` as its parts; noon for anything else. */
export const timeParts = (value: string): number[] => {
  const [, ...parts] = /^(?:[^T]*T)?(\d{2}):(\d{2})(?::(\d{2}))?/u.exec(value) ?? [];
  return parts.length === 0 ? [12, 0] : parts.filter((part) => part !== undefined).map(Number);
};

export const formatTime = (parts: readonly number[]): string => parts.map((part) => pad(part)).join(":");

export type Hsv = { hue: number; saturation: number; value: number };

/** `#rrggbb`, with or without its `#`, or none. */
export const parseHex = (text: string): string | undefined => {
  const [, hex] = /^#?([0-9a-f]{6})$/iu.exec(text.trim()) ?? [];
  return hex === undefined ? undefined : `#${hex.toLowerCase()}`;
};

export const toHsv = (hex: string): Hsv => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const range = max - Math.min(r, g, b);
  const sector = max === r ? (g - b) / range : max === g ? (b - r) / range + 2 : (r - g) / range + 4;
  return {
    hue: range === 0 ? 0 : ((sector + 6) % 6) * 60,
    saturation: max === 0 ? 0 : range / max,
    value: max,
  };
};

export const toHex = ({ hue, saturation, value }: Hsv): string =>
  `#${[5, 3, 1]
    .map((n) => (n + hue / 60) % 6)
    .map((k) => value - value * saturation * Math.max(0, Math.min(k, 4 - k, 1)))
    .map((level) =>
      Math.round(level * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
