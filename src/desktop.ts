import type { Domicile } from "@domicile-desktop/sdk/shell";
import { getContext } from "svelte";

/** The context key `index.ts` mounts the desktop under. */
export const desktopKey = Symbol("domicile");

/** The desktop API, for any component under the shell's root. */
export const useDomicile = (): Domicile => {
  const domicile = getContext<Domicile | undefined>(desktopKey);
  if (domicile === undefined) {
    throw new Error("useDomicile called outside the shell's root");
  }
  return domicile;
};
