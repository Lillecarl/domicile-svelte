import { describe, expect, test } from "bun:test";

import { ago, arrivals, toastMs, toasts, unread } from "./toasting";

const at = (id: number, time: number) => ({ id, time });

describe("arrivals", () => {
  test("the first list is history", () => {
    expect(arrivals(undefined, [at(1, 10)])).toEqual([]);
  });
  test("a new id arrives", () => {
    expect(arrivals([at(1, 10)], [at(1, 10), at(2, 20)])).toEqual([at(2, 20)]);
  });
  test("a replaced one arrives again", () => {
    expect(arrivals([at(1, 10)], [at(1, 30)])).toEqual([at(1, 30)]);
  });
  test("a cleared one is no arrival", () => {
    expect(arrivals([at(1, 10), at(2, 20)], [at(2, 20)])).toEqual([]);
  });
});

describe("toastMs", () => {
  test("the sender decides, with a floor", () => {
    expect(toastMs({ timeoutMs: 9000, urgency: "normal" })).toBe(9000);
    expect(toastMs({ timeoutMs: 1, urgency: "normal" })).toBe(2000);
  });
  test("none asked has a default", () => {
    expect(toastMs({ timeoutMs: undefined, urgency: "low" })).toBe(6000);
  });
  test("zero and critical stay up", () => {
    expect(toastMs({ timeoutMs: 0, urgency: "normal" })).toBeUndefined();
    expect(toastMs({ timeoutMs: 3000, urgency: "critical" })).toBeUndefined();
  });
});

test("only critical ones show while paused", () => {
  expect(toasts({ urgency: "normal" }, true)).toBe(false);
  expect(toasts({ urgency: "critical" }, true)).toBe(true);
  expect(toasts({ urgency: "low" }, false)).toBe(true);
});

test("unread counts what came after the history was last open", () => {
  expect(unread([at(1, 10), at(2, 20)], 10)).toBe(1);
});

test("ago", () => {
  const now = new Date(100 * 3_600_000);
  expect(ago(now.getTime() - 5_000, now)).toBe("now");
  expect(ago(now.getTime() - 5 * 60_000, now)).toBe("5 min");
  expect(ago(now.getTime() - 3 * 3_600_000, now)).toBe("3 h");
});
