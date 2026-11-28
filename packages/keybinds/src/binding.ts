/** What a binding is about, in the order the explorer lists them. */
export const GROUPS = ["Apps", "Windows", "Focus", "Move", "Workspaces", "Desktop"] as const;
export type Group = (typeof GROUPS)[number];

/** A chord the shell grabs, what it does in words, and what it runs. */
export type Binding = {
  /** As the shell grabs it, sway-style: `Meta+Shift+H`. */
  chord: string;
  label: string;
  group: Group;
  run: () => void;
};

/** The modifiers a chord can hold, in the order a chord spells them. */
export const MODIFIERS = ["Meta", "Ctrl", "Alt", "Shift"] as const;
export type Modifier = (typeof MODIFIERS)[number];

/** A chord taken apart: its modifiers, and its key as the keyboard names it. */
export type Parts = { modifiers: ReadonlySet<Modifier>; key: string };

/**
 * `chord` taken apart. A letter's key is lower case, as the key is the same
 * with Shift held: `Meta+Shift+H` is Shift and Meta on the `h` key.
 */
export const partsOf = (chord: string): Parts => {
  const words = chord.split("+");
  const last = words.at(-1) ?? "";
  const modifiers = new Set(words.slice(0, -1).flatMap((word) => MODIFIERS.filter((each) => each === word)));
  return { key: /^[A-Za-z]$/u.test(last) ? last.toLowerCase() : last, modifiers };
};

const same = (a: ReadonlySet<Modifier>, b: ReadonlySet<Modifier>) =>
  a.size === b.size && [...a].every((each) => b.has(each));

/** Whether `binding` fires with exactly `held`, as the engine matches modifiers. */
export const firesWith = (binding: Binding, held: ReadonlySet<Modifier>): boolean =>
  same(partsOf(binding.chord).modifiers, held);

/**
 * The bindings on each key: with modifiers `held`, those that fire with
 * exactly them; with none held, every binding on the key.
 */
export const onKeys = (
  bindings: readonly Binding[],
  held: ReadonlySet<Modifier>,
): ReadonlyMap<string, readonly Binding[]> => {
  const keys = new Map<string, Binding[]>();
  for (const binding of bindings) {
    if (held.size === 0 || firesWith(binding, held)) {
      const { key } = partsOf(binding.chord);
      keys.set(key, [...(keys.get(key) ?? []), binding]);
    }
  }
  return keys;
};

/**
 * The bindings whose label, group or chord holds every word of `query`, in
 * group order then as listed. An empty query matches all.
 */
export const matching = (bindings: readonly Binding[], query: string): Binding[] => {
  const words = query
    .toLowerCase()
    .split(/\s+/u)
    .filter((word) => word !== "");
  const found = bindings.filter((binding) => {
    const text = `${binding.label} ${binding.group} ${binding.chord} ${shownChord(binding.chord)}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
  return GROUPS.flatMap((group) => found.filter((binding) => binding.group === group));
};

/** How the explorer writes a key: the character for a symbol keysym. */
const KEY_NAMES: Readonly<Record<string, string>> = {
  Down: "↓",
  Left: "←",
  Return: "Enter",
  Right: "→",
  Up: "↑",
  bracketleft: "[",
  bracketright: "]",
  comma: ",",
  period: ".",
  question: "?",
  slash: "/",
  space: "Space",
};

/** A key as a person reads it: `bracketleft` is `[`. */
export const shownKey = (key: string): string => KEY_NAMES[key] ?? key;

/** A chord as a person reads it: `Meta+bracketleft` is `Meta + [`. */
export const shownChord = (chord: string): string => {
  const words = chord.split("+");
  return [...words.slice(0, -1), shownKey(words.at(-1) ?? "")].join(" + ");
};
