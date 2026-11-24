import { type Ask, hostOf } from "./ask";

type Prompt = Pick<DomicilePromptEvent, "accept" | "details" | "dismiss" | "kind" | "origin" | "pin" | "subject">;

/** A question Chrome has a dialog of its own for. None for a kind unknown here. */
export const promptAsk = (event: Prompt): Ask | undefined => {
  const site = hostOf(event.origin) ?? "This site";
  const { subject, details } = event;
  const asked = {
    grants: true,
    no: "Cancel",
    accept: () => event.accept(),
    dismiss: () => event.dismiss(),
  };
  const can = details.length > 0 ? "It can:" : "It needs no special permissions.";
  switch (event.kind) {
    case "file-view":
      return {
        ...asked,
        title: `Let ${site} view ${subject}?`,
        message: `${site} can see it until you close all its windows.`,
        details,
        yes: "Allow",
        no: "Do not allow",
      };
    case "file-edit":
      return {
        ...asked,
        title: `Let ${site} edit ${subject}?`,
        message: `${site} can save changes to it until you close all its windows.`,
        details,
        yes: "Allow",
        no: "Do not allow",
      };
    case "file-restricted":
      return {
        ...asked,
        title: "Pick a different folder",
        message: `It holds system files, so ${site} cannot open it.`,
        yes: "Pick another",
      };
    case "file-dangerous":
      return {
        ...asked,
        title: `Save ${subject} anyway?`,
        message: "This kind of file can harm your computer.",
        details,
        yes: "Save anyway",
      };
    case "client-certificate":
      return {
        ...asked,
        title: "Choose a certificate",
        message: `${site} asks for a certificate to sign you in.`,
        choices: details.map((certificate, value) => {
          const [label = "", issuer] = certificate.split("\n");
          return { value, label, ...(issuer === undefined ? {} : { detail: `Issued by ${issuer}` }) };
        }),
        picked: 0,
        yes: "Sign in",
        accept: ({ choice }) => event.accept(choice),
      };
    case "bluetooth-pin":
      return {
        ...asked,
        title: `Pair with ${subject}`,
        fields: [{ label: "The device's PIN", kind: "text", value: "" }],
        yes: "Pair",
        accept: ({ texts }) => event.accept(0, texts[0] ?? ""),
      };
    case "bluetooth-confirm":
      return {
        ...asked,
        title: `Pair with ${subject}?`,
        message:
          event.pin === "" ? `${site} wants to pair with this device.` : `Check that ${subject} shows ${event.pin}.`,
        yes: "Pair",
      };
    case "extension-install":
      return { ...asked, title: `Add ${subject}?`, message: can, details, yes: "Add extension" };
    case "extension-permissions":
      return {
        ...asked,
        title: `${subject} wants more permissions`,
        message: details.length > 0 ? "It asks to:" : "It asks for more access.",
        details,
        yes: "Allow",
        no: "Do not allow",
      };
    case "extension-re-enable":
      return { ...asked, title: `Turn ${subject} back on?`, message: can, details, yes: "Turn on" };
    case "resend-form":
      return {
        ...asked,
        title: "Send the form again?",
        message: "The page sends what you entered again, which can repeat a purchase or a post.",
        yes: "Send again",
      };
    case "unresponsive":
      return {
        ...asked,
        title: "This page does not respond",
        message: `${subject === "" ? site : subject} does not respond. You can wait, or close it and reload it later.`,
        yes: "Close page",
        no: "Wait",
      };
    default:
      return undefined;
  }
};
