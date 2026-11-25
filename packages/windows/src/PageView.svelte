<!-- An Electron app's view: a page over its window's page, where the app puts it. -->
<script lang="ts">
  import type { BrowserWindow } from "@domicile-desktop/sdk/desktop/browser";
  import { untrack } from "svelte";

  import PageHints from "./PageHints.svelte";

  const { view }: { view: BrowserWindow } = $props();

  // The engine reads `window` once, when the element connects, and the list
  // hands a new object on every change: one element, made here.
  const element = document.createElement("webview") as HTMLWebViewElement;
  untrack(() => element.setAttribute("window", view.id));
  const mount = (box: HTMLElement) => {
    box.prepend(element);
    return () => element.remove();
  };
</script>

<!-- A hidden one stays laid out: a page draws only while it is. -->
<div
  style:left="{view.x}px"
  style:top="{view.y}px"
  style:width="{view.width}px"
  style:height="{view.height}px"
  style:visibility={view.isHidden ? "hidden" : undefined}
  {@attach mount}
>
  <PageHints view={element} />
</div>

<style>
  div {
    position: absolute;
  }
</style>
