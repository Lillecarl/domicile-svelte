/** What typed text names: an address to load, or words to search for. */
export type Address = { kind: "url"; url: string } | { kind: "search"; url: string; words: string };

const SEARCH = "https://duckduckgo.com/?q=";

/**
 * Read `text` as an address bar does: a URL with a scheme as typed, a dotted
 * word as https, anything else a web search. `undefined` for blank text.
 */
export const addressOf = (text: string): Address | undefined => {
  const trimmed = text.trim();
  if (trimmed === "") {
    return undefined;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return { kind: "url", url: trimmed };
  }
  if (/^[^\s]+\.[^\s]+$/.test(trimmed)) {
    return { kind: "url", url: `https://${trimmed}` };
  }
  return { kind: "search", url: `${SEARCH}${encodeURIComponent(trimmed)}`, words: trimmed };
};
