// Vim keys for pages: j/k/d/u/gg/G scroll, f follows a link by its hint, F
// opens it in a new window, i focuses the field the page wanted focused, H and
// L go back and forward, Escape leaves an input or the hints.
//
// The clickable rules follow Vimium's content_scripts/link_hints.js (MIT),
// the hint strings Vimium C's content/hint_filters.ts (Apache-2.0, Gong
// Dahan). It runs in every frame; the frame that has the keyboard answers.
//
// A reload injects a new copy into open pages (background.js), into the same
// isolated world as the copy already there. So the script is one block, and
// the old copy drops its listeners when the new one announces itself.
{
  const REPLACE = "pagekeys-replace";
  document.dispatchEvent(new Event(REPLACE));
  const quit = new AbortController();
  const on = (type, listener, capture = false) =>
    window.addEventListener(type, listener, { capture, signal: quit.signal });

  // Vimium C's letters, in its order: the first hints are home row.
  const HINT_CHARS = "sadjklewcmpgh";
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

  function* elements(root) {
    for (const element of root.querySelectorAll("*")) {
      yield element;
      if (element.shadowRoot !== null) {
        yield* elements(element.shadowRoot);
      }
    }
  }

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

  const parentOf = (node) => node.parentElement ?? node.getRootNode().host ?? null;

  // --- Input -------------------------------------------------------------------

  // Until the user acts on the page, a field the page focuses itself (an
  // autofocused search box) loses the focus again and waits here for i, as in
  // Vimium's grabBackFocus. A key the page gets, a click, or i ends the guard.
  let wanted;
  let interacted = false;

  const grabBack = (target) => {
    if (interacted || !editable(target)) {
      return false;
    }
    wanted = target;
    target.blur();
    return true;
  };

  // A page without the window focus focuses a field with no focusin; the first
  // key finds it instead.
  on("focusin", (event) => grabBack(event.composedPath()[0]), true);

  const focusInput = (element) => {
    interacted = true;
    element.focus();
  };

  const firstInput = () => {
    for (const element of elements(document)) {
      if (editable(element) && !element.disabled && visibleRect(element) !== undefined) {
        return element;
      }
    }
    return undefined;
  };

  const focusWanted = () => {
    const target = wanted?.isConnected && !wanted.disabled ? wanted : firstInput();
    if (target !== undefined) {
      focusInput(target);
    }
  };

  // --- Scrolling ---------------------------------------------------------------

  // Where the page was last clicked: scrolling follows it into a scrolled pane,
  // as Vimium's does.
  let activated;
  on(
    "pointerdown",
    (event) => {
      activated = event.composedPath()[0];
      interacted ||= event.isTrusted;
    },
    true,
  );

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

  // --- Hints -------------------------------------------------------------------

  // Vimium C's initAlphabetEngine. The hints are the leaves of a tree over
  // HINT_CHARS, so no hint is the prefix of another, and as many as possible
  // are one letter. Each hint packs its letters' positions in HINT_CHARS into a
  // number, first letter lowest; sorting those numbers keeps HINT_CHARS' order
  // (home row first) instead of the alphabet's.
  const hintStrings = (count) => {
    const step = HINT_CHARS.length;
    const bits = Math.ceil(Math.log2(step + 1));
    const mask = (1 << bits) - 1;
    const expand = Math.ceil((count - 1) / (step - 1)) || 1;
    const codes = [0];
    let next = 1;
    let shift = 0;
    for (let offset = 0; offset < expand; ) {
      if (next === offset) {
        next = next * step + 1;
        shift += bits;
      }
      const code = codes[offset++];
      for (let char = 1; char <= step; char++) {
        codes.push((char << shift) | code);
      }
    }
    // A shorter hint sorts among the longer ones that end in its letter.
    while (next-- > expand) {
      codes[next] <<= bits;
    }
    return codes
      .slice(expand, expand + count)
      .sort((a, b) => a - b)
      .map((code) => {
        let rest = code & mask ? code : code >> bits;
        let hint = "";
        for (; rest !== 0; rest >>>= bits) {
          hint += HINT_CHARS[(rest & mask) - 1];
        }
        return hint;
      });
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

  // "strong" is clickable by its tag or role; "weak" only by its tabindex,
  // which Vimium drops when a clickable ancestor already has a hint.
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
      focusInput(element);
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
  on("scroll", exitHints, true);
  on("resize", exitHints);
  on("blur", exitHints);

  // --- Keys --------------------------------------------------------------------

  const commands = {
    j: () => scrollBy(1, () => STEP),
    k: () => scrollBy(-1, () => STEP),
    d: () => scrollBy(1, (target) => viewHeight(target) / 2),
    u: () => scrollBy(-1, (target) => viewHeight(target) / 2),
    G: () => scrollToEnd(1),
    f: () => enterHints(false),
    F: () => enterHints(true),
    i: focusWanted,
    H: () => history.back(),
    L: () => history.forward(),
  };

  // The g of a gg.
  let pending = false;

  const consume = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  on(
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
      if (editable(target) && !grabBack(target)) {
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
      } else {
        interacted ||= event.isTrusted;
      }
    },
    true,
  );

  document.addEventListener(
    REPLACE,
    () => {
      exitHints();
      quit.abort();
    },
    { once: true, signal: quit.signal },
  );
}
