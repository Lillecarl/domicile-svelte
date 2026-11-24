import { type FileChooserBody, FileChooserMode } from "@domicile-desktop/sdk/portal";

type Asked = Pick<DomicileFileChooserEvent, "accept" | "currentFolder" | "home" | "mode" | "suggestedName">;

/** A page's file picker, as the file chooser applications get asks for it. */
export const chooserOf = ({ accept, currentFolder, home, mode, suggestedName }: Asked): FileChooserBody => ({
  acceptLabel: mode === "open-folder" ? "Upload" : undefined,
  choices: [],
  currentFilter: undefined,
  currentFolder: currentFolder === undefined || currentFolder === "" ? undefined : currentFolder,
  currentName: suggestedName === "" ? undefined : suggestedName,
  directory: mode === "open-folder",
  files: [],
  filters:
    accept.length === 0
      ? []
      : [
          {
            name: accept.length > 4 ? "Accepted files" : accept.map((each) => `.${each}`).join(" "),
            extensions: accept,
          },
          { name: "All files", extensions: [] },
        ],
  home,
  mode: mode === "save" ? FileChooserMode.Save : FileChooserMode.Open,
  multiple: mode === "open-multiple",
  title: { save: "Save file", "open-folder": "Upload folder", "open-multiple": "Upload files" }[mode] ?? "Upload file",
});
