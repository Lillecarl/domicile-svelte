/** A question over a page, as `PageAsk` draws it. */
export type Ask = {
  title: string;
  /** Drawn before the title. */
  icon?: string;
  message?: string;
  /** Lines that stand for themselves, such as a path, a link or a permission. */
  details?: readonly string[];
  fields?: readonly { label: string; kind: "text" | "password"; value: string }[];
  choices?: readonly { value: number; label: string; detail?: string; icon?: string }[];
  /** The choice made at first; else none, and the user must make one. */
  picked?: number;
  /** A box to tick. */
  tick?: string;
  note?: string;
  links?: readonly { label: string; url: string }[];
  /** The button that says yes, and the one that says no. One without has no such button. */
  yes?: string;
  no?: string;
  extra?: readonly { label: string; run: () => void }[];
  /** Yes gives something away: No has the keyboard, and Yes waits for the user to have read it. */
  grants?: boolean;
  /** In the page's corner, which stays usable, and without the keyboard. */
  aside?: boolean;
  accept: (answer: Answer) => void;
  dismiss: () => void;
};

export type Answer = { texts: readonly string[]; choice: number; ticked: boolean };

/** The host of `origin`, or none for a frame with no site. */
export const hostOf = (origin: string): string | undefined => URL.parse(origin)?.host || undefined;

type Dialog = Pick<DomicileDialogEvent, "accept" | "defaultValue" | "dialogType" | "dismiss" | "message" | "origin">;

/** A page's `alert()`, `confirm()`, `prompt()` or `beforeunload`; none for a kind unknown here. */
export const dialogAsk = (event: Dialog): Ask | undefined => {
  const says = `${hostOf(event.origin) ?? "This page"} says`;
  const asked = { title: says, message: event.message, dismiss: () => event.dismiss() };
  switch (event.dialogType) {
    case "alert":
      return { ...asked, yes: "OK", accept: () => event.accept() };
    case "confirm":
      return { ...asked, yes: "OK", no: "Cancel", accept: () => event.accept() };
    case "prompt":
      return {
        ...asked,
        fields: [{ label: "", kind: "text", value: event.defaultValue }],
        yes: "OK",
        no: "Cancel",
        accept: ({ texts }) => event.accept(texts[0] ?? ""),
      };
    case "beforeunload":
      return {
        ...asked,
        title: "Leave site?",
        message: "Changes you made may not be saved.",
        yes: "Leave",
        no: "Stay",
        accept: () => event.accept(),
      };
    default:
      return undefined;
  }
};
