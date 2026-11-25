/** niri's touchpad swipes, each run once it has gone far enough. */

/** What it reads of the SDK's `Gesture`, whose module the SDK does not export. */
export type Gesture = { kind: string; phase: string; fingers: number; dx: number; dy: number };

export type Swipe = { readonly fingers: number; readonly direction: "left" | "right" | "up" | "down" };

/** How far fingers go, in pointer units. */
const FAR = 120;

/**
 * Feed each gesture in; `run` hears a swipe each time it has gone `FAR` more
 * along the axis it started on.
 */
export const swipes = (run: (swipe: Swipe) => void): ((gesture: Gesture) => void) => {
  let x = 0;
  let y = 0;
  let axis: "x" | "y" | undefined;
  return ({ kind, phase, fingers, dx, dy }) => {
    if (kind !== "swipe") {
      return;
    }
    if (phase !== "update") {
      x = 0;
      y = 0;
      axis = undefined;
      return;
    }
    x += dx;
    y += dy;
    if (axis === undefined && Math.max(Math.abs(x), Math.abs(y)) >= FAR) {
      axis = Math.abs(x) > Math.abs(y) ? "x" : "y";
    }
    const along = axis === "x" ? x : y;
    if (axis === undefined || Math.abs(along) < FAR) {
      return;
    }
    run({ fingers, direction: axis === "x" ? (along < 0 ? "left" : "right") : along < 0 ? "up" : "down" });
    x = 0;
    y = 0;
  };
};
