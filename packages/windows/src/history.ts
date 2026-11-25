import type { Entry } from "@domicile-svelte/menu";

/** As many pages as Chrome's menu lists. */
const LISTED = 12;

/** Back's or Forward's menu. */
export const historyMenu = (pages: readonly DomicileHistoryEntry[], go: (id: number) => void): Entry[] =>
  pages.slice(0, LISTED).map(({ id, title, url, favicon }) => ({
    kind: "item",
    key: `${id}`,
    label: title === "" ? url : title,
    enabled: true,
    ...(favicon === "" ? {} : { image: favicon }),
    run: () => go(id),
  }));
