import { expect, test } from "bun:test";

import { moved, opening, reshaped, resized } from "./box";
import { clock, playhead } from "./playhead";

const screen = { width: 1600, height: 900 };
const wide = { width: 1920, height: 1080 };

test("a video opens small, in the corner, in its shape", () => {
  expect(opening(screen, wide)).toEqual({ width: 400, height: 225, x: 1176, y: 651 });
  const tall = opening(screen, { width: 100, height: 1000 });
  expect(tall).toMatchObject({ width: 90, height: 900, y: 0 });
});

test("it moves, and stays on the screen", () => {
  const box = opening(screen, wide);
  expect(moved(box, screen, -100, -50)).toMatchObject({ x: 1076, y: 601 });
  expect(moved(box, screen, 9999, -9999)).toMatchObject({ x: 1200, y: 0 });
});

test("a corner resizes it from the one across", () => {
  const box = { width: 400, height: 225, x: 800, y: 400 };
  expect(resized(box, screen, wide, { left: true, top: true }, -160)).toEqual({
    width: 560,
    height: 315,
    x: 640,
    y: 310,
  });
  expect(resized(box, screen, wide, { left: false, top: false }, 160)).toEqual({
    width: 560,
    height: 315,
    x: 800,
    y: 400,
  });
  expect(resized(box, screen, wide, { left: false, top: false }, -999).width).toBe(240);
  expect(resized(box, screen, wide, { left: false, top: false }, 9999)).toEqual({
    width: 1600,
    height: 900,
    x: 0,
    y: 0,
  });
});

test("a new shape keeps the corner", () => {
  const box = { width: 400, height: 225, x: 800, y: 400 };
  expect(reshaped(box, screen, { width: 1, height: 1 })).toEqual({ width: 400, height: 400, x: 800, y: 225 });
});

test("the time goes on while it plays", () => {
  const heard = { at: 1000, duration: 10, playing: true, position: 2, playbackRate: 2 };
  expect(playhead(heard, 2000)).toBe(4);
  expect(playhead(heard, 99_000)).toBe(10);
  expect(playhead({ ...heard, playing: false }, 2000)).toBe(2);
  expect([clock(102.9), clock(3723)]).toEqual(["1:42", "1:02:03"]);
});
