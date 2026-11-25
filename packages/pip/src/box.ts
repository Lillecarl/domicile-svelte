/** Where a video floats on the screen, always in the video's shape. */
export type Size = { width: number; height: number };
export type Box = Size & { x: number; y: number };
export type Corner = { left: boolean; top: boolean };

const MARGIN = 24;
const OPENS_AT = 0.25;
const WIDEST = 480;
/** Narrower, its controls do not fit. */
const NARROWEST = 240;

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));
const heightFor = (width: number, shape: Size): number => Math.round((width * shape.height) / shape.width);

/** The widest the video is whole on `screen`. */
const widestOn = (screen: Size, shape: Size): number =>
  Math.min(screen.width, (screen.height * shape.width) / shape.height);

/** `box` moved no further than it must to be on `screen`. */
export const kept = (box: Box, screen: Size): Box => ({
  ...box,
  x: clamp(box.x, 0, Math.max(0, screen.width - box.width)),
  y: clamp(box.y, 0, Math.max(0, screen.height - box.height)),
});

/** A new video's, in the bottom-right corner. */
export const opening = (screen: Size, shape: Size): Box => {
  const width = Math.round(Math.min(clamp(screen.width * OPENS_AT, NARROWEST, WIDEST), widestOn(screen, shape)));
  const height = heightFor(width, shape);
  return kept({ width, height, x: screen.width - MARGIN - width, y: screen.height - MARGIN - height }, screen);
};

export const moved = (box: Box, screen: Size, dx: number, dy: number): Box =>
  kept({ ...box, x: box.x + dx, y: box.y + dy }, screen);

/** `box` with `corner` dragged by `dx`; the corner across from it stays. */
export const resized = (box: Box, screen: Size, shape: Size, corner: Corner, dx: number): Box => {
  const most = widestOn(screen, shape);
  const width = Math.round(clamp(box.width + (corner.left ? -dx : dx), Math.min(NARROWEST, most), most));
  const height = heightFor(width, shape);
  return kept(
    {
      width,
      height,
      x: corner.left ? box.x + box.width - width : box.x,
      y: corner.top ? box.y + box.height - height : box.y,
    },
    screen,
  );
};

/** `box` in a new `shape`, its bottom-right corner where it was. */
export const reshaped = (box: Box, screen: Size, shape: Size): Box =>
  resized(box, screen, shape, { left: true, top: true }, 0);
