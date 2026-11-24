import type {
  WebViewIdentityAccount,
  WebViewIdentityField,
  WebViewIdentityProvider,
  WebViewIdentityPurpose,
} from "@domicile-desktop/sdk/webview-element";

import { type Ask, hostOf } from "./ask";

type SignIn = Pick<DomicileSignInEvent, "dismiss" | "proxy" | "secure" | "signIn" | "url">;

/**
 * The user name and password a site or a proxy wants. Its realm is the
 * server's own words, and is not shown, as Chrome does not.
 */
export const signInAsk = (event: SignIn): Ask => {
  const host = hostOf(event.url) ?? event.url;
  const open = event.secure ? "" : " Your connection to it is not private.";
  return {
    title: event.proxy ? "Sign in to your network's proxy" : `Sign in to ${host}`,
    message: `${event.proxy ? `The proxy at ${host}` : "This site"} needs a user name and password.${open}`,
    fields: [
      { label: "User name", kind: "text", value: "" },
      { label: "Password", kind: "password", value: "" },
    ],
    yes: "Sign in",
    no: "Cancel",
    accept: ({ texts }) => event.signIn(texts[0] ?? "", texts[1] ?? ""),
    dismiss: () => event.dismiss(),
  };
};

type Identity = Pick<
  DomicileIdentityEvent,
  | "accounts"
  | "button"
  | "choose"
  | "dismiss"
  | "errorUrl"
  | "moreDetails"
  | "providers"
  | "purpose"
  | "signInToProvider"
  | "site"
  | "step"
>;

const VERBS: Record<WebViewIdentityPurpose, string> = {
  continue: "Continue to",
  "sign-in": "Sign in to",
  "sign-up": "Sign up to",
  use: "Use",
};

const FIELDS: Record<WebViewIdentityField, string> = {
  email: "email address",
  name: "name",
  "phone-number": "phone number",
  picture: "profile picture",
  username: "user name",
};

const listed = (items: readonly string[]): string =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1) ?? ""}`;

// What signing in shares the first time, and the site's policies.
const sharing = (
  accounts: readonly WebViewIdentityAccount[],
  providers: readonly WebViewIdentityProvider[],
): Pick<Ask, "note" | "links"> => {
  const account = accounts.find(({ shared }) => shared.length > 0);
  const provider = providers[account?.provider ?? 0];
  if (account === undefined || provider === undefined) {
    return {};
  }
  return {
    note: `${provider.name} will share your ${listed(account.shared.map((field) => FIELDS[field]))} with this site.`,
    links: [
      { label: "Privacy policy", url: provider.privacyPolicy },
      { label: "Terms of service", url: provider.termsOfService },
    ].filter(({ url }) => url !== ""),
  };
};

/** A step of a site's "Sign in with". One it offers unasked stays out of the way. */
export const identityAsk = (event: Identity): Ask => {
  const providers = event.providers();
  const accounts = event.accounts();
  const only = providers.length === 1 ? providers[0] : undefined;
  const name = providers[0]?.name ?? "the provider";
  const asked: Ask = {
    title: `${VERBS[event.purpose]} ${event.site}${only === undefined ? "" : ` with ${only.name}`}`,
    aside: !event.button,
    grants: true,
    no: "Cancel",
    accept: () => undefined,
    dismiss: () => event.dismiss(),
    ...(only?.icon ? { icon: only.icon } : {}),
  };
  switch (event.step) {
    case "loading":
      return { ...asked, message: "Finding your accounts…" };
    case "accounts": {
      const adders = providers.flatMap((provider, at) => (provider.addAccount ? [{ provider, at }] : []));
      const first = accounts.length === 1 ? accounts[0]?.name.split(/\s+/u)[0] : undefined;
      return {
        ...asked,
        ...sharing(accounts, providers),
        choices: accounts.map((account, value) => ({
          value,
          label: account.name,
          detail: account.identifier,
          ...(account.picture === "" ? {} : { icon: account.picture }),
        })),
        picked: 0,
        extra: adders.map(({ provider, at }) => ({
          label: providers.length === 1 ? "Use another account" : `Use another ${provider.name} account`,
          run: () => event.signInToProvider(at),
        })),
        yes: first === undefined ? "Continue" : `Continue as ${first}`,
        accept: ({ choice }) => event.choose(choice),
      };
    }
    case "signed-out":
      return {
        ...asked,
        message: `You are not signed in to ${name}. Sign in there, then pick your account.`,
        yes: `Sign in to ${name}`,
        accept: () => event.signInToProvider(0),
      };
    case "verifying": {
      const { no: _, ...silent } = asked;
      return { ...silent, title: `Signing you in to ${event.site}`, message: accounts[0]?.name ?? "" };
    }
    case "error": {
      const { no: _, ...alone } = asked;
      return {
        ...alone,
        title: `Cannot sign in with ${name}`,
        message: `${name} did not let ${event.site} sign you in. Try again later, or use the site's own sign-in.`,
        extra: event.errorUrl === "" ? [] : [{ label: "More details", run: () => event.moreDetails() }],
        yes: "OK",
        accept: () => event.dismiss(),
      };
    }
  }
};
