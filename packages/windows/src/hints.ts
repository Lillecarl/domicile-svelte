type Size = { width: number; height: number };

/** Clear of the cursor, in CSS pixels. */
const BELOW_POINTER = 20;
const ABOVE_POINTER = 4;

/** Where a tooltip goes: under the pointer and inside its page, or over the pointer at the page's bottom. */
export const tipPlace = (pointer: { x: number; y: number }, tip: Size, page: Size) => {
  const below = pointer.y + BELOW_POINTER;
  return {
    left: Math.max(0, Math.min(pointer.x, page.width - tip.width)),
    top: below + tip.height > page.height ? Math.max(0, pointer.y - tip.height - ABOVE_POINTER) : below,
  };
};
