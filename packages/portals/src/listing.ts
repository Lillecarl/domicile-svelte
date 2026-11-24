/** What a folder shows in the file chooser. Pure functions over names. */
export type Entry = { readonly name: string; readonly folder: boolean };

export type Filter = { readonly extensions: readonly string[] };

export const joined = (folder: string, name: string): string => (folder === "/" ? `/${name}` : `${folder}/${name}`);

export const parentOf = (folder: string): string => folder.slice(0, Math.max(1, folder.lastIndexOf("/")));

/** Whether `name` ends in one of the filter's extensions, or the filter takes any file. */
export const accepts = (filter: Filter | undefined, name: string): boolean =>
  filter === undefined ||
  filter.extensions.length === 0 ||
  filter.extensions.some((extension) => name.toLowerCase().endsWith(`.${extension}`));

/**
 * The entries to list: folders first, then the files `filter` accepts, by
 * name. Dotfiles only when `query` starts with a dot. `query` is matched
 * anywhere in the name, in any case.
 */
export const listed = (
  entries: readonly Entry[],
  { query, filter, foldersOnly }: { query: string; filter: Filter | undefined; foldersOnly: boolean },
): Entry[] => {
  const wanted = query.toLowerCase();
  return entries
    .filter(({ name }) => query.startsWith(".") || !name.startsWith("."))
    .filter(({ name }) => name.toLowerCase().includes(wanted))
    .filter(({ name, folder }) => folder || (!foldersOnly && accepts(filter, name)))
    .toSorted((a, b) =>
      a.folder === b.folder ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.folder ? -1 : 1,
    );
};

/**
 * The folder typed text looks in, and the name or search in it. A path
 * (`/…`, `~/…`, `../…`, or any text with a slash) is taken from the root, the
 * home or `folder`; its last part is the search.
 */
export const placeOf = (text: string, folder: string, home: string): { folder: string; query: string } => {
  const typed = text === "~" || text === ".." ? `${text}/` : text;
  const slash = typed.lastIndexOf("/");
  if (slash === -1) {
    return { folder, query: text };
  }
  const path = typed.slice(0, slash + 1);
  const from = path.startsWith("/") ? "" : path.startsWith("~/") ? home : `${folder}/`;
  return { folder: cleaned(from + (path.startsWith("~/") ? path.slice(1) : path)), query: typed.slice(slash + 1) };
};

const cleaned = (path: string): string => {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "..") {
      parts.pop();
    } else if (part !== "" && part !== ".") {
      parts.push(part);
    }
  }
  return `/${parts.join("/")}`;
};

/** A name a file can be saved under. */
export const savable = (name: string): boolean =>
  name !== "" && name !== "." && name !== ".." && !name.includes("/") && !name.includes("\0");
