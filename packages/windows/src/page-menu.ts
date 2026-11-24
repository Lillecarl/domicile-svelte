import type { WebViewContextMenuAction } from "@domicile-desktop/sdk/webview-element";
import type { Entry } from "@domicile-svelte/menu";

import { searchUrl } from "./address";

/** What the menu asks of its window. */
export type PageActions = {
  canGoBack: boolean;
  canGoForward: boolean;
  back: () => void;
  forward: () => void;
  reload: () => void;
  open: (url: string) => void;
};

type Click = Pick<
  DomicileContextMenuEvent,
  | "canCopy"
  | "canCut"
  | "canDelete"
  | "canPaste"
  | "canPictureInPicture"
  | "canRedo"
  | "canSelectAll"
  | "canUndo"
  | "hasImageContents"
  | "inPictureInPicture"
  | "isEditable"
  | "linkUrl"
  | "mediaType"
  | "misspelledWord"
  | "replaceMisspelling"
  | "run"
  | "selectionText"
  | "spellingSuggestions"
  | "srcUrl"
>;

const QUOTED = 40;

/** Chrome's menu for a right click in a page, with `extensions`' items before Inspect. */
export const pageMenu = (click: Click, page: PageActions, extensions: readonly Entry[]): Entry[] => {
  const item = (label: string, run: () => void, enabled = true, hint?: string): Entry => ({
    kind: "item",
    key: label,
    label,
    enabled,
    hint,
    run,
  });
  const does = (label: string, action: WebViewContextMenuAction, enabled = true): Entry =>
    item(label, () => click.run(action), enabled);

  const noun = { image: "image", canvas: "image", video: "video", audio: "audio" }[click.mediaType];
  const overLink = click.linkUrl !== "";
  const overMedia = noun !== undefined;
  const selected = click.selectionText.replaceAll(/\s+/gu, " ").trim();
  const quoted = selected.length > QUOTED ? `${selected.slice(0, QUOTED)}…` : selected;
  const pixels = click.hasImageContents && noun === "image";
  const address = overMedia && click.srcUrl !== "";

  const groups: Entry[][] = [
    click.misspelledWord === ""
      ? []
      : [
          ...(click.spellingSuggestions.length === 0
            ? [item("No spelling suggestions", () => undefined, false)]
            : click.spellingSuggestions.map(
                (word): Entry => ({
                  kind: "item",
                  key: `spelling:${word}`,
                  label: word,
                  enabled: true,
                  run: () => click.replaceMisspelling(word),
                }),
              )),
          does("Add to dictionary", "add-to-dictionary"),
        ],
    overLink
      ? [
          item("Open link in new window", () => page.open(click.linkUrl)),
          does("Save link as…", "save-link-as"),
          does("Copy link address", "copy-link-address"),
        ]
      : [],
    [
      ...(address ? [item(`Open ${noun} in new window`, () => page.open(click.srcUrl))] : []),
      ...(address || pixels ? [does(`Save ${noun} as…`, "save-media-as")] : []),
      ...(pixels ? [does("Copy image", "copy-image")] : []),
      ...(address ? [does(`Copy ${noun} address`, "copy-media-address")] : []),
      ...(click.canPictureInPicture
        ? [does(click.inPictureInPicture ? "Exit picture in picture" : "Picture in picture", "picture-in-picture")]
        : []),
    ],
    click.isEditable
      ? [does("Undo", "undo", click.canUndo), does("Redo", "redo", click.canRedo)]
      : [],
    click.isEditable
      ? [
          does("Cut", "cut", click.canCut),
          does("Copy", "copy", click.canCopy),
          does("Paste", "paste", click.canPaste),
          does("Paste as plain text", "paste-and-match-style", click.canPaste),
          does("Delete", "delete", click.canDelete),
          does("Select all", "select-all", click.canSelectAll),
        ]
      : [],
    selected === "" || click.isEditable
      ? []
      : [does("Copy", "copy"), item(`Search for “${quoted}”`, () => page.open(searchUrl(selected)))],
    overLink || overMedia || selected !== "" || click.isEditable
      ? []
      : [
          item("Back", page.back, page.canGoBack, "Alt+Left"),
          item("Forward", page.forward, page.canGoForward, "Alt+Right"),
          item("Reload", page.reload, true, "Ctrl+R"),
        ],
    extensions.map((entry) => ({ ...entry, key: `extension:${entry.key}` })),
    [does("Inspect", "inspect")],
  ];
  return groups
    .filter((group) => group.length > 0)
    .flatMap((group, index): Entry[] => (index === 0 ? group : [{ kind: "separator", key: `group:${index}` }, ...group]));
};
