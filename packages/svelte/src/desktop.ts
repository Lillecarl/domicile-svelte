import type { Domicile, Shell } from "@domicile-desktop/sdk/shell";
import { type Component, getContext, mount } from "svelte";

const desktopKey = Symbol("domicile");

/** The desktop API, for any component under {@link mountShell}'s root. */
export const useDomicile = (): Domicile => {
  const domicile = getContext<Domicile | undefined>(desktopKey);
  if (domicile === undefined) {
    throw new Error("useDomicile called outside a shell mounted with mountShell");
  }
  return domicile;
};

/**
 * A domicile `Shell` that mounts `root` with the desktop in context.
 *
 * It mounts into a container of its own: domicile reports load errors by
 * appending to the page's `root`.
 */
export const mountShell =
  (root: Component, start?: (domicile: Domicile) => void): Shell =>
  (page, domicile) => {
    const target = document.createElement("div");
    page.append(target);
    mount(root, { target, context: new Map([[desktopKey, domicile]]) });
    start?.(domicile);
  };
