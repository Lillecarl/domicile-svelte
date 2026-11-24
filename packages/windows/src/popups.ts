/** What places a client's menu or tooltip: its window list entry. */
export type Listed = {
  readonly appId: string;
  readonly parent?: string | undefined;
  readonly x?: number | undefined;
  readonly y?: number | undefined;
};

export type Popup<Window extends Listed> = { window: Window; x: number; y: number };

/**
 * The popups over the window `appId`, however deep (a submenu's parent is its
 * menu), oldest first, each from the window's top left corner.
 */
export const popupsOf = <Window extends Listed>(list: readonly Window[], appId: string): Popup<Window>[] => {
  const offset = (id: string, over: readonly string[]): { x: number; y: number } | undefined => {
    if (id === appId) {
      return { x: 0, y: 0 };
    }
    const window = list.find((each) => each.appId === id);
    // A popup listed before its parent is, or after it went.
    if (window?.parent === undefined || over.includes(id)) {
      return undefined;
    }
    const base = offset(window.parent, [...over, id]);
    return base === undefined ? undefined : { x: base.x + (window.x ?? 0), y: base.y + (window.y ?? 0) };
  };
  return list.flatMap((window) => {
    const at = window.parent === undefined ? undefined : offset(window.appId, []);
    return at === undefined ? [] : [{ window, ...at }];
  });
};
