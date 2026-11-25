/** Why a page shows nothing, for the shell to say: the engine draws no error, warning or crash page. */
export type Problem = {
  title: string;
  message: string;
  /** Chromium's name for it. */
  code?: string;
  /** A warning: going on is held back, and reloading answers nothing. */
  warning?: string;
  canProceed: boolean;
};

type Page = Pick<
  HTMLWebViewElement,
  | "pageFailure"
  | "pageFailureCanProceed"
  | "pageFailureError"
  | "pageFailureHttpStatus"
  | "pageFailureUrl"
  | "renderProcessGone"
>;

const network = (error: string, host: string): [title: string, message: string] => {
  const unreached = `Cannot reach ${host}`;
  switch (error) {
    case "ERR_INTERNET_DISCONNECTED":
      return ["You are offline", "Connect to the internet and try again."];
    case "ERR_NAME_NOT_RESOLVED":
    case "ERR_NAME_RESOLUTION_FAILED":
      return [unreached, "Its address was not found. Check it for a mistake."];
    case "ERR_CONNECTION_REFUSED":
      return [unreached, `${host} refused to connect.`];
    case "ERR_CONNECTION_TIMED_OUT":
    case "ERR_TIMED_OUT":
      return [unreached, `${host} took too long to answer.`];
    case "ERR_TOO_MANY_REDIRECTS":
      return [`${host} does not work`, "It sent the browser around in circles."];
    case "ERR_FILE_NOT_FOUND":
      return ["File not found", "It may have been moved, renamed or deleted."];
    case "ERR_BLOCKED_BY_CLIENT":
    case "ERR_BLOCKED_BY_ADMINISTRATOR":
      return ["This page is blocked", "It cannot be opened here."];
    default:
      return [unreached, "Something went wrong on the way to it."];
  }
};

/** What is wrong with `page`, if anything. A crash comes first: a failed page's renderer may be gone too. */
export const problemOf = (page: Page): Problem | undefined => {
  if (page.renderProcessGone !== "") {
    return page.renderProcessGone === "oom"
      ? { title: "This page ran out of memory", message: "It used more than there was.", canProceed: false }
      : {
          title: "This page crashed",
          message: "Something went wrong while it was shown.",
          code: page.renderProcessGone,
          canProceed: false,
        };
  }
  const host = URL.parse(page.pageFailureUrl)?.host || page.pageFailureUrl;
  const asked = { code: page.pageFailureError, canProceed: page.pageFailureCanProceed };
  switch (page.pageFailure) {
    case "":
      return undefined;
    case "http":
      return {
        ...asked,
        title: `${host} does not work`,
        message: "It answered with an error, and nothing to show.",
        code: `HTTP ${page.pageFailureHttpStatus}`,
      };
    case "certificate":
      return {
        ...asked,
        title: "Your connection is not private",
        message: `Its certificate is not trusted. Someone may pretend to be ${host} to read what you send.`,
        warning: "Continue only if you know why, such as a device on your own network.",
      };
    case "warning":
      return {
        ...asked,
        title: `${host} may not be safe`,
        message: "The browser stopped it before it loaded. It may trick you or harm your computer.",
        warning: "Continue only if you trust this site.",
      };
    case "network": {
      const [title, message] = network(page.pageFailureError, host);
      return { ...asked, title, message };
    }
  }
};
