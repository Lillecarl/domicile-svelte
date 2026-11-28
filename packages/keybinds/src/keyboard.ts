/** One key on the drawn keyboard: its keysym as a chord names it, and how wide it is. */
export type Key = { key: string; width?: number };

const row = (keys: string): Key[] => [...keys].map((key) => ({ key: SYMBOLS[key] ?? key }));

// The keysym a chord names for each character on the keys.
const SYMBOLS: Readonly<Record<string, string>> = {
  ",": "comma",
  "-": "minus",
  ".": "period",
  "/": "slash",
  ";": "semicolon",
  "=": "equal",
  "[": "bracketleft",
  "\\": "backslash",
  "]": "bracketright",
  "`": "grave",
  "'": "apostrophe",
};

/**
 * A US keyboard, the shape eurkey and most layouts share, by row. Drawn by
 * keysym rather than read from the layout, so a key the layout moves is in
 * its US place.
 */
export const KEYBOARD: readonly (readonly Key[])[] = [
  [
    { key: "Escape", width: 1.5 },
    { key: "Print", width: 1.5 },
    { key: "Delete", width: 1.5 },
  ],
  [...row("`1234567890-="), { key: "BackSpace", width: 2 }],
  [{ key: "Tab", width: 1.5 }, ...row("qwertyuiop[]"), { key: "backslash", width: 1.5 }],
  [{ key: "Caps_Lock", width: 1.75 }, ...row("asdfghjkl;'"), { key: "Return", width: 2.25 }],
  [{ key: "Shift_L", width: 2.25 }, ...row("zxcvbnm,./"), { key: "Shift_R", width: 2.75 }],
  [
    { key: "Control_L", width: 1.25 },
    { key: "Super_L", width: 1.25 },
    { key: "Alt_L", width: 1.25 },
    { key: "space", width: 5.25 },
    { key: "Home" },
    { key: "End" },
    { key: "Left" },
    { key: "Down" },
    { key: "Up" },
    { key: "Right" },
  ],
];

/** The modifier a modifier key holds, for the keys drawn as modifiers. */
export const MODIFIER_KEYS: Readonly<Record<string, "Meta" | "Ctrl" | "Alt" | "Shift">> = {
  Alt_L: "Alt",
  Control_L: "Ctrl",
  Shift_L: "Shift",
  Shift_R: "Shift",
  Super_L: "Meta",
};

/** How a key's cap reads, for the keys whose keysym is not what is printed on it. */
const CAPS: Readonly<Record<string, string>> = {
  Alt_L: "Alt",
  BackSpace: "⌫",
  Caps_Lock: "Caps",
  Control_L: "Ctrl",
  Delete: "Del",
  Escape: "Esc",
  Shift_L: "Shift",
  Shift_R: "Shift",
  Super_L: "Meta",
  Tab: "Tab",
  apostrophe: "'",
  backslash: "\\",
  equal: "=",
  grave: "`",
  minus: "-",
  semicolon: ";",
};

/** What is printed on `key`'s cap, given how the explorer writes keys. */
export const capOf = (key: string, shown: (key: string) => string): string => CAPS[key] ?? shown(key);
