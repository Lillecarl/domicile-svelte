<!--
  Browser extensions' actions, as Chrome's toolbar draws them. A click
  activates the extension and opens its popup, if it has one, below the bar.
  A right-click lists its commands and the items it adds to its menu, which
  act on the browser window last focused.
-->
<script lang="ts">
  import { BarItem } from "@domicile-svelte/bar";
  import { commandsOf, entriesOf, runsCommands } from "@domicile-svelte/extensions";
  import { type Entry, Menu } from "@domicile-svelte/menu";
  import { useDomicile, watch } from "@domicile-svelte/svelte";

  import Popup from "./Popup.svelte";

  const {
    onclose,
  }: {
    /** A popup closed and gave up the keyboard: hand it back. */
    onclose?: () => void;
  } = $props();

  const { browser, extensions } = useDomicile();
  const list = watch(extensions, "change", () => (extensions.list ?? []).filter(({ enabled }) => enabled));

  let open = $state<{ id: string; url: string; right: number }>();
  const anchors: Record<string, HTMLElement> = {};

  const show = (id: string, url: string) => {
    const box = anchors[id]?.getBoundingClientRect();
    open = { id, url, right: box === undefined ? 0 : Math.max(0, window.innerWidth - box.right) };
  };

  const close = () => {
    open = undefined;
    onclose?.();
  };

  const click = (id: string, popup: string | undefined) => {
    extensions.activate(id);
    if (open?.id === id) {
      close();
    } else if (popup !== undefined) {
      show(id, popup);
    }
  };

  let menu = $state.raw<{ id: string; title: string; entries: Entry[]; x: number; y: number }>();
  const closeMenu = () => {
    menu = undefined;
    onclose?.();
  };

  const own = (id: string): Entry[] => {
    const options = extensions.installed?.find((each) => each.id === id)?.optionsUrl;
    return [
      ...commandsOf(extensions, id).map(
        ({ name, description, keys }): Entry => ({
          kind: "item",
          key: `command:${name}`,
          label: description || (name === "_execute_action" ? "Open" : name),
          enabled: true,
          hint: keys?.label,
          run: () => extensions.runCommand(id, name),
        }),
      ),
      { kind: "separator", key: "items" },
      ...(options === undefined
        ? []
        : [{ kind: "item" as const, key: "options", label: "Options", enabled: true, run: () => browser.open(options) }]),
    ];
  };

  const showMenu = (event: MouseEvent, id: string, title: string) => {
    event.preventDefault();
    if (!runsCommands(extensions)) {
      return;
    }
    const box = anchors[id]?.getBoundingClientRect();
    extensions
      .menu(id)
      .then((items) => {
        const entries: Entry[] = [
          ...entriesOf(items, (item) => extensions.runMenuItem(item)),
          { kind: "separator", key: "own" },
          ...own(id),
        ];
        open = undefined;
        menu = { id, title, entries, x: box?.left ?? 0, y: box?.bottom ?? 0 };
      })
      .catch((error: unknown) => console.error("[bar-extensions] menu:", error));
  };

  $effect(() => extensions.on("popup", ({ id, popup }) => show(id, popup)));
</script>

{#each list.current as extension (extension.id)}
  <span class="action" bind:this={anchors[extension.id]}>
    <BarItem
      title={extension.title || extension.name}
      onclick={() => click(extension.id, extension.popup)}
      oncontextmenu={(event) => showMenu(event, extension.id, extension.title || extension.name)}
    >
      <img src={extension.icon} alt={extension.title || extension.name} />
      {#if extension.badgeText !== ""}
        <span class="badge" style:background={extension.badgeColor}>{extension.badgeText}</span>
      {/if}
    </BarItem>
  </span>
{/each}

{#if open !== undefined}
  {#key open}
    <Popup url={open.url} right={open.right} trigger={anchors[open.id]} onclose={close} />
  {/key}
{/if}

{#if menu !== undefined}
  {#key menu}
    <Menu entries={menu.entries} x={menu.x} y={menu.y} label={menu.title} trigger={anchors[menu.id]} onclose={closeMenu} />
  {/key}
{/if}

<style>
  .action {
    position: relative;
    display: inline-flex;
  }

  img {
    width: 18px;
    height: 18px;
  }

  .badge {
    position: absolute;
    right: 2px;
    bottom: 2px;
    padding: 0 3px;
    border-radius: 4px;
    font-size: 9px;
    line-height: 12px;
    color: #fff;
  }
</style>
