import type { ShotRect } from "@domicile-desktop/sdk/portal";

type Point = { x: number; y: number };

/** The frame pixel under `client` when the frame is drawn over `box`, kept on its edge when off it. */
export const framePoint = (
  client: Point,
  box: { left: number; top: number; width: number; height: number },
  frame: { width: number; height: number },
): Point => ({
  x: along(client.x - box.left, box.width, frame.width),
  y: along(client.y - box.top, box.height, frame.height),
});

const along = (offset: number, drawn: number, pixels: number): number =>
  Math.min(pixels - 1, Math.max(0, Math.floor((offset / drawn) * pixels)));

/** The area a drag covers, both ends included. */
export const draggedArea = (from: Point, to: Point): ShotRect => ({
  x: Math.min(from.x, to.x),
  y: Math.min(from.y, to.y),
  width: Math.abs(to.x - from.x) + 1,
  height: Math.abs(to.y - from.y) + 1,
});
