// Vim keys for pages: j/k/d/u/gg/G scroll, f follows a link by its hint, F
// opens it in a new window, Escape leaves an input or the hints.
//
// The clickable rules and the hint strings follow Vimium's
// content_scripts/link_hints.js (MIT). It runs in every frame; the frame
// that has the keyboard answers.

const HINT_CHARS = "sadfjklewcmpgh";
const STEP = 60;

const NOT_TEXT = new Set(["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"]);
const ROLES = new Set([
  "button",
  "checkbox",
  "link",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "switch",
  "tab",
  "textbox",
]);

const editable = (element) =>
  element instanceof HTMLElement &&
  (element.isContentEditable ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    (element instanceof HTMLInputElement && !NOT_TEXT.has(element.type)));

// --- Scrolling ---------------------------------------------------------------

// Where the page was last clicked: scrolling follows it into a scrolled pane,
// as Vimium's does.
let activated;
window.addEventListener("pointerdown", (event) => (activated = event.composedPath()[0]), true);

const parentOf = (node) => node.parentElement ?? node.getRootNode().host ?? null;

const canScroll = (element, direction) => {
  const page = element === document.scrollingElement;
  if (!page && !/auto|scroll|overlay/.test(getComputedStyle(element).overflowY)) {
    return false;
  }
  if (element.scrollHeight <= element.clientHeight) {
    return false;
  }
  return direction > 0 ? element.scrollTop + element.clientHeight < element.scrollHeight - 1 : element.scrollTop > 0;
};

// A page whose document does not scroll (an app with a scrolled main pane)
// scrolls its largest visible pane.
const largestPane = (direction) => {
  let best;
  let area = 0;
  for (const element of document.querySelectorAll("*")) {
    if (element.clientHeight * element.clientWidth > area && canScroll(element, direction)) {
      best = element;
      area = element.clientHeight * element.clientWidth;
    }
  }
  return best;
};

const scroller = (direction) => {
  for (let node = activated; node instanceof Element; node = parentOf(node)) {
    if (canScroll(node, direction)) {
      return node;
    }
  }
  const page = document.scrollingElement;
  if (page !== null && canScroll(page, direction)) {
    return page;
  }
  const pane = largestPane(direction);
  activated = pane;
  return pane;
};

const viewHeight = (element) => (element === document.scrollingElement ? window.innerHeight : element.clientHeight);

const scrollBy = (direction, amount) => {
  const target = scroller(direction);
  target?.scrollBy({ top: direction * amount(target) });
};

const scrollToEnd = (direction) => {
  const target = scroller(direction);
  target?.scrollTo({ top: direction > 0 ? target.scrollHeight : 0 });
};

// --- Hints ---------------------------------------------------------------------

// Vimium's hintStrings: the leaves of a tree over HINT_CHARS, so no hint is
// the prefix of another, sorted so that the first letters spread out.
const hintStrings = (count) => {
  const hints = [""];
  let offset = 0;
  while (hints.length - offset < count || hints.length === 1) {
    const hint = hints[offset++];
    for (const char of HINT_CHARS) {
      hints.push(char + hint);
    }
  }
  return hints
    .slice(offset, offset + count)
    .sort()
    .map((hint) => [...hint].reverse().join(""));
};

const visibleRect = (element) => {
  for (const rect of element.getClientRects()) {
    const left = Math.max(rect.left, 0);
    const top = Math.max(rect.top, 0);
    const right = Math.min(rect.right, window.innerWidth);
    const bottom = Math.min(rect.bottom, window.innerHeight);
    if (right - left >= 3 && bottom - top >= 3) {
      return { left, top, right, bottom };
    }
  }
  return undefined;
};

// Covered elements (under a dialog, a sticky header) get no hint.
const onTop = (element, rect) => {
  const root = element.getRootNode();
  const points = [
    [(rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2],
    [rect.left + 1, rect.top + 1],
  ];
  return points.some(([x, y]) => {
    const hit = root.elementFromPoint(x, y);
    return hit !== null && (element === hit || element.contains(hit));
  });
};

const disabled = (element) => element.disabled === true;

// "strong" is clickable by its tag or role; "weak" only by its tabindex, which
// Vimium drops when a clickable ancestor already has a hint.
const clickable = (element) => {
  const aria = element.getAttribute("aria-disabled");
  if (aria === "" || aria === "true") {
    return undefined;
  }
  switch (element.localName) {
    case "a":
    case "details":
    case "summary":
    case "embed":
    case "object":
      return "strong";
    case "button":
    case "select":
      return disabled(element) ? undefined : "strong";
    case "textarea":
      return disabled(element) || element.readOnly ? undefined : "strong";
    case "input":
      return element.type === "hidden" || disabled(element) ? undefined : "strong";
    case "label":
      // A styled checkbox hides its input and shows its label.
      return element.control && !disabled(element.control) && visibleRect(element.control) === undefined
        ? "strong"
        : undefined;
  }
  if (element.hasAttribute("onclick") || element.isContentEditable) {
    return "strong";
  }
  if (ROLES.has(element.getAttribute("role")?.toLowerCase())) {
    return "strong";
  }
  if (/(^|;)\s*(click:)?[\w.]+\s*(;|$)/.test(element.getAttribute("jsaction") ?? "")) {
    return "strong";
  }
  const tabindex = element.getAttribute("tabindex");
  return tabindex !== null && Number(tabindex) >= 0 ? "weak" : undefined;
};

function* elements(root) {
  for (const element of root.querySelectorAll("*")) {
    yield element;
    if (element.shadowRoot !== null) {
      yield* elements(element.shadowRoot);
    }
  }
}

const targets = () => {
  const found = [];
  const hinted = new Set();
  for (const element of elements(document)) {
    const kind = clickable(element);
    if (kind === undefined) {
      continue;
    }
    const rect = visibleRect(element);
    if (rect === undefined || !onTop(element, rect)) {
      continue;
    }
    if (kind === "weak") {
      let ancestor = parentOf(element);
      for (let depth = 0; depth < 3 && ancestor !== null && !hinted.has(ancestor); depth++) {
        ancestor = parentOf(ancestor);
      }
      if (ancestor !== null && hinted.has(ancestor)) {
        continue;
      }
    }
    hinted.add(element);
    found.push({ element, rect });
  }
  return found;
};

const STYLE = `
  .hint {
    position: fixed;
    padding: 0 3px;
    border: 1px solid #1e1e2e;
    border-radius: 3px;
    background: #f9e2af;
    color: #1e1e2e;
    font: bold 12px/16px "Hack Nerd Font", monospace;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .typed { opacity: 0.4; }
`;

const click = (element) => {
  const rect = element.getBoundingClientRect();
  const at = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
    button: 0,
  };
  element.dispatchEvent(new PointerEvent("pointerover", at));
  element.dispatchEvent(new MouseEvent("mouseover", at));
  element.dispatchEvent(new PointerEvent("pointerdown", { ...at, buttons: 1 }));
  element.dispatchEvent(new MouseEvent("mousedown", { ...at, buttons: 1 }));
  element.dispatchEvent(new PointerEvent("pointerup", at));
  element.dispatchEvent(new MouseEvent("mouseup", at));
  element.dispatchEvent(new MouseEvent("click", at));
};

const follow = (element, newWindow) => {
  activated = element;
  const link = element.closest("a[href]");
  if (newWindow && link !== null) {
    window.open(link.href, "_blank", "noopener");
  } else if (editable(element)) {
    element.focus();
  } else {
    click(element);
  }
};

// The open hints, or undefined outside hint mode.
let hints;

const exitHints = () => {
  hints?.host.remove();
  hints = undefined;
};

const enterHints = (newWindow) => {
  const found = targets();
  if (found.length === 0) {
    return;
  }
  const host = document.createElement("div");
  host.style.cssText = "all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = STYLE;
  shadow.append(style);
  const markers = hintStrings(found.length).map((text, index) => {
    const { element, rect } = found[index];
    const label = document.createElement("span");
    label.className = "hint";
    label.style.left = `${rect.left}px`;
    label.style.top = `${rect.top}px`;
    label.textContent = text;
    shadow.append(label);
    return { text, element, label };
  });
  document.documentElement.append(host);
  hints = { host, markers, typed: "", newWindow };
};

const showTyped = () => {
  for (const marker of hints.markers) {
    const match = marker.text.startsWith(hints.typed);
    marker.label.hidden = !match;
    if (match) {
      const typed = document.createElement("span");
      typed.className = "typed";
      typed.textContent = hints.typed;
      marker.label.replaceChildren(typed, marker.text.slice(hints.typed.length));
    }
  }
};

const hintKey = (event) => {
  if (event.key === "Escape") {
    exitHints();
  } else if (event.key === "Backspace") {
    hints.typed = hints.typed.slice(0, -1);
    showTyped();
  } else if (event.key.length === 1 && HINT_CHARS.includes(event.key.toLowerCase())) {
    const typed = hints.typed + event.key.toLowerCase();
    const matches = hints.markers.filter((marker) => marker.text.startsWith(typed));
    if (matches.length === 0) {
      return;
    }
    hints.typed = typed;
    if (matches.length === 1 && matches[0].text === typed) {
      const { newWindow } = hints;
      exitHints();
      follow(matches[0].element, newWindow);
    } else {
      showTyped();
    }
  }
};

// Hints sit where the page was when they opened.
window.addEventListener("scroll", exitHints, true);
window.addEventListener("resize", exitHints);
window.addEventListener("blur", exitHints);

// --- Keys ----------------------------------------------------------------------

const commands = {
  j: () => scrollBy(1, () => STEP),
  k: () => scrollBy(-1, () => STEP),
  d: () => scrollBy(1, (target) => viewHeight(target) / 2),
  u: () => scrollBy(-1, (target) => viewHeight(target) / 2),
  G: () => scrollToEnd(1),
  f: () => enterHints(false),
  F: () => enterHints(true),
};

// The g of a gg.
let pending = false;

const consume = (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
};

window.addEventListener(
  "keydown",
  (event) => {
    if (event.isComposing || ["Shift", "Control", "Alt", "Meta"].includes(event.key)) {
      return;
    }
    if (hints !== undefined) {
      consume(event);
      hintKey(event);
      return;
    }
    if (event.ctrlKey || event.altKey || event.metaKey) {
      pending = false;
      return;
    }
    const target = event.composedPath()[0];
    if (editable(target)) {
      // Escape hands the keys back from an input, as in Vimium.
      if (event.key === "Escape") {
        target.blur();
      }
      return;
    }
    if (event.key === "g") {
      consume(event);
      if (pending) {
        scrollToEnd(-1);
      }
      pending = !pending;
      return;
    }
    pending = false;
    const command = commands[event.key];
    if (command !== undefined) {
      consume(event);
      command();
    }
  },
  true,
);
