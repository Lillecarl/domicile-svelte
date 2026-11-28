import { WEBVIEW_AD_BLOCKING_MODES, type WebViewAdBlocking } from "@domicile-desktop/sdk/webview-element";
import type { Entry } from "@domicile-svelte/menu";

/** How the bar shows a web page's address: its host apart from the rest. */
export type Site = { secure: boolean; host: string; rest: string };

/** The site `url` is on, or `undefined` for an address that is not `http` or `https`. */
export const siteOf = (url: string): Site | undefined => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return undefined;
  }
  const rest = `${parsed.pathname}${parsed.search}`;
  return { secure: parsed.protocol === "https:", host: parsed.host, rest: rest === "/" ? "" : rest };
};

/** What a page's shield says: how its site blocks ads and trackers, and how many it blocked. */
export type Shield = { site: string; mode: WebViewAdBlocking; kept: boolean; blocked: number };

const isMode = (mode: string): mode is WebViewAdBlocking =>
  (WEBVIEW_AD_BLOCKING_MODES as readonly string[]).includes(mode);

/** The shield of a page, or `undefined` for one the engine never blocks for. */
export const shieldOf = (view: {
  privacySite: string;
  blockAdsAndTrackers: string;
  blockAdsAndTrackersSetFor: string;
  blockedCount: number;
}): Shield | undefined =>
  view.privacySite === "" || !isMode(view.blockAdsAndTrackers)
    ? undefined
    : {
        site: view.privacySite,
        mode: view.blockAdsAndTrackers,
        kept: view.blockAdsAndTrackersSetFor === "site",
        blocked: view.blockedCount,
      };

const MODES: Readonly<Record<WebViewAdBlocking, string>> = {
  standard: "Block other sites' ads and trackers",
  strict: "Block its own ads and trackers too",
  off: "Block nothing",
};

/** A menu that sets how `shield`'s site blocks. `null` goes back to the profile's. */
export const shieldMenu = (shield: Shield, set: (mode: WebViewAdBlocking | null) => void): Entry[] => [
  {
    kind: "item",
    key: "blocked",
    label: `${shield.blocked} blocked on ${shield.site}`,
    enabled: false,
  },
  { kind: "separator", key: "modes" },
  ...WEBVIEW_AD_BLOCKING_MODES.map((mode): Entry => ({
    kind: "item",
    key: mode,
    label: MODES[mode],
    enabled: true,
    toggle: { kind: "radio", on: shield.kept && shield.mode === mode },
    run: () => set(mode),
  })),
  {
    kind: "item",
    key: "profile",
    label: "As the profile says",
    enabled: true,
    toggle: { kind: "radio", on: !shield.kept },
    run: () => set(null),
  },
];
