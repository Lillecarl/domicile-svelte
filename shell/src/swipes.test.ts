import { expect, test } from "bun:test";

import { type Gesture, swipes } from "./swipes";

const gesture = (phase: string, dx = 0, dy = 0): Gesture => ({
  kind: "swipe",
  phase,
  fingers: 3,
  dx,
  dy,
});

const heard = (...fed: Gesture[]): string[] => {
  const all: string[] = [];
  const hear = swipes(({ fingers, direction }) => all.push(`${fingers} ${direction}`));
  fed.forEach(hear);
  return all;
};

test("a swipe runs once it is far enough, and again for as much more", () => {
  expect(heard(gesture("begin"), gesture("update", 5, -60), gesture("end"))).toEqual([]);
  expect(heard(gesture("begin"), gesture("update", 5, -60), gesture("update", 0, -60))).toEqual(["3 up"]);
  expect(heard(gesture("begin"), gesture("update", -130), gesture("update", -130))).toEqual(["3 left", "3 left"]);
});

test("it keeps to the axis it started on", () => {
  expect(heard(gesture("begin"), gesture("update", 130), gesture("update", 0, 400))).toEqual(["3 right"]);
});

test("each gesture starts anew", () => {
  expect(
    heard(gesture("begin"), gesture("update", 0, 100), gesture("end"), gesture("begin"), gesture("update", 0, 100)),
  ).toEqual([]);
});
