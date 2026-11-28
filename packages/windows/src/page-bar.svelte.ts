import { getContext, type Snippet, setContext } from "svelte";

/**
 * Where the focused browser window draws its controls: back and forward, the
 * site and the address. A shell that provides one shows them in its bar, and
 * each window then has no toolbar of its own.
 */
export class PageBar {
  #shown = $state.raw<{ controls: Snippet }>();

  /** The controls of the window that has the bar, if one has. */
  get controls(): Snippet | undefined {
    return this.#shown?.controls;
  }

  /** Show `controls`, in place of any others. The answer takes them back. */
  show(controls: Snippet): () => void {
    // A window's own object: the same snippet shown twice is two showings.
    const shown = { controls };
    this.#shown = shown;
    return () => {
      if (this.#shown === shown) {
        this.#shown = undefined;
      }
    };
  }
}

const key = Symbol("page-bar");

/** Give the windows under this component a bar to draw into. */
export const providePageBar = (): PageBar => setContext(key, new PageBar());

/** The bar a shell gave, if it gave one. */
export const usePageBar = (): PageBar | undefined => getContext<PageBar | undefined>(key);
