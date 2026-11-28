/**
 * One physical key: its `KeyboardEvent.code`, how wide it is, and, for a key
 * that types nothing, the keysym a chord names it by.
 */
export type Key = { code: string; width?: number; keysym?: string };

const typing = (codes: string): Key[] => codes.split(" ").map((code) => ({ code }));

const row = (...keys: (Key | Key[])[]): Key[] => keys.flat();

/**
 * A keyboard by row, 15 keys wide below the top row. ISO has the key beside
 * left Shift that Swedish and most European layouts type on, and Enter over
 * two rows; ANSI, the US shape, has neither.
 */
export const keyboardFor = (iso: boolean): readonly (readonly Key[])[] => [
  [
    { code: "Escape", keysym: "Escape", width: 1.5 },
    { code: "PrintScreen", keysym: "Print", width: 1.5 },
    { code: "Delete", keysym: "Delete", width: 1.5 },
  ],
  row(typing("Backquote Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus Equal"), {
    code: "Backspace",
    keysym: "BackSpace",
    width: 2,
  }),
  row(
    { code: "Tab", keysym: "Tab", width: 1.5 },
    typing("KeyQ KeyW KeyE KeyR KeyT KeyY KeyU KeyI KeyO KeyP BracketLeft BracketRight"),
    iso ? { code: "Enter", keysym: "Return", width: 1.5 } : { code: "Backslash", width: 1.5 },
  ),
  row(
    { code: "CapsLock", keysym: "Caps_Lock", width: 1.75 },
    typing("KeyA KeyS KeyD KeyF KeyG KeyH KeyJ KeyK KeyL Semicolon Quote"),
    iso
      ? [{ code: "Backslash" }, { code: "Enter", keysym: "Return", width: 1.25 }]
      : [{ code: "Enter", keysym: "Return", width: 2.25 }],
  ),
  row(
    iso
      ? [{ code: "ShiftLeft", keysym: "Shift_L", width: 1.25 }, { code: "IntlBackslash" }]
      : [{ code: "ShiftLeft", keysym: "Shift_L", width: 2.25 }],
    typing("KeyZ KeyX KeyC KeyV KeyB KeyN KeyM Comma Period Slash"),
    { code: "ShiftRight", keysym: "Shift_R", width: 2.75 },
  ),
  [
    { code: "ControlLeft", keysym: "Control_L", width: 1.25 },
    { code: "MetaLeft", keysym: "Super_L", width: 1.25 },
    { code: "AltLeft", keysym: "Alt_L", width: 1.25 },
    { code: "Space", keysym: "space", width: 5.25 },
    { code: "Home", keysym: "Home" },
    { code: "End", keysym: "End" },
    { code: "ArrowLeft", keysym: "Left" },
    { code: "ArrowDown", keysym: "Down" },
    { code: "ArrowUp", keysym: "Up" },
    { code: "ArrowRight", keysym: "Right" },
  ],
];

/** What each key types on a US layout: the map when the engine gives none. */
export const US_LAYOUT: ReadonlyMap<string, string> = new Map([
  ...[..."abcdefghijklmnopqrstuvwxyz"].map((letter) => [`Key${letter.toUpperCase()}`, letter] as const),
  ...[..."0123456789"].map((digit) => [`Digit${digit}`, digit] as const),
  ["Backquote", "`"],
  ["Minus", "-"],
  ["Equal", "="],
  ["BracketLeft", "["],
  ["BracketRight", "]"],
  ["Backslash", "\\"],
  ["Semicolon", ";"],
  ["Quote", "'"],
  ["Comma", ","],
  ["Period", "."],
  ["Slash", "/"],
]);

// The xkb keysym for each character a key may type that is not its own
// keysym. A letter or digit is its own.
const KEYSYMS: Readonly<Record<string, string>> = {
  "'": "apostrophe",
  "+": "plus",
  ",": "comma",
  "-": "minus",
  ".": "period",
  "/": "slash",
  ";": "semicolon",
  "<": "less",
  "=": "equal",
  "[": "bracketleft",
  "\\": "backslash",
  "]": "bracketright",
  "`": "grave",
  "§": "section",
  å: "aring",
  ä: "adiaeresis",
  ö: "odiaeresis",
};

/** The keysym a chord names `key` by: its own, or the one for what it types on `layout`. */
export const keysymOf = (key: Key, layout: ReadonlyMap<string, string>): string | undefined => {
  const typed = layout.get(key.code);
  return key.keysym ?? (typed === undefined ? undefined : (KEYSYMS[typed] ?? typed.toLowerCase()));
};

/** The modifier a modifier key holds. */
export const MODIFIER_KEYS: Readonly<Record<string, "Meta" | "Ctrl" | "Alt" | "Shift">> = {
  AltLeft: "Alt",
  ControlLeft: "Ctrl",
  MetaLeft: "Meta",
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
};

/** How a key's cap reads, for the keys that type nothing. */
const CAPS: Readonly<Record<string, string>> = {
  AltLeft: "Alt",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  Backspace: "⌫",
  CapsLock: "Caps",
  ControlLeft: "Ctrl",
  Delete: "Del",
  End: "End",
  Enter: "Enter",
  Escape: "Esc",
  Home: "Home",
  MetaLeft: "Meta",
  PrintScreen: "Print",
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  Space: "Space",
  Tab: "Tab",
};

/** What is printed on `key`'s cap on `layout`. */
export const capOf = (key: Key, layout: ReadonlyMap<string, string>): string =>
  CAPS[key.code] ?? layout.get(key.code)?.toUpperCase() ?? "";

/** The Keyboard Map API, which TypeScript's DOM types do not have yet. */
type KeyboardMap = { getLayoutMap: () => Promise<ReadonlyMap<string, string>> };

/**
 * What each key types on the layout the desktop types on now, from the
 * engine's keymap, or `undefined` where the page has no Keyboard Map API.
 */
export const readLayout = async (): Promise<ReadonlyMap<string, string> | undefined> => {
  const { keyboard } = navigator as Navigator & { keyboard?: KeyboardMap };
  return keyboard === undefined ? undefined : new Map(await keyboard.getLayoutMap());
};
