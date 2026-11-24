import { type Ask, hostOf } from "./ask";

type Link = Pick<DomicileExternalAppEvent, "dismiss" | "mayRemember" | "open" | "origin" | "url">;

/** The desktop file id of the application that opens `url`; none when none does. */
export const appIn = ({ code, stdout }: { code: number | undefined; stdout: string }): string | undefined => {
  const id = stdout.trim().replace(/\.desktop$/u, "");
  return code !== 0 || id === "" ? undefined : id;
};

/** A link for an application, such as `zoommtg:`, that `app` opens. */
export const externalAppAsk = (event: Link, app: string | undefined): Ask => {
  const host = hostOf(event.origin);
  const asked = { details: [event.url], dismiss: () => event.dismiss() };
  if (app === undefined) {
    return {
      ...asked,
      title: "No application opens this link",
      message: `Nothing on this computer opens ${event.url.slice(0, event.url.indexOf(":"))} links.`,
      yes: "Close",
      accept: () => event.dismiss(),
    };
  }
  return {
    ...asked,
    title: `Open ${app}?`,
    message: `${host ?? "This page"} wants to open this link in ${app}.`,
    ...(event.mayRemember && host !== undefined ? { tick: `Always let ${host} open these links in ${app}` } : {}),
    grants: true,
    yes: "Open",
    no: "Cancel",
    accept: ({ ticked }) => event.open(ticked),
  };
};
