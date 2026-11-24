import type { PageRange } from "@domicile-desktop/sdk/portal";

/** Pages typed as `1-3, 5`. Blank is every page, as no ranges; `undefined` when it cannot be read. */
export const pageRanges = (text: string): readonly PageRange[] | undefined => {
  const ranges = text.trim() === "" ? [] : text.split(",").map((part) => pageRange(part.trim()));
  return ranges.every((range) => range !== undefined) ? ranges : undefined;
};

const pageRange = (part: string): PageRange | undefined => {
  const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
  if (match === null) {
    return undefined;
  }
  const first = Number(match[1]);
  const last = match[2] === undefined ? first : Number(match[2]);
  return first >= 1 && first <= last ? { first, last } : undefined;
};

/** The ranges as `pageRanges` reads them. */
export const pagesText = (ranges: readonly PageRange[]): string =>
  ranges.map(({ first, last }) => (first === last ? `${first}` : `${first}-${last}`)).join(", ");
