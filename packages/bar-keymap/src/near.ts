/** A place or a size, in the page's CSS pixels. */
export type Point = { x: number; y: number };
export type Size = { width: number; height: number };

/** How far the label sits from the pointer, and from the page's edges. */
const GAP = 16;
const MARGIN = 8;

/**
 * Where to put a label of `label`'s size near the pointer at `at`: below and
 * right of it, moved back inside `page` where it would cross an edge.
 */
export const near = (at: Point, label: Size, page: Size): Point => ({
  x: Math.max(MARGIN, Math.min(at.x + GAP, page.width - label.width - MARGIN)),
  y: Math.max(MARGIN, Math.min(at.y + GAP, page.height - label.height - MARGIN)),
});
