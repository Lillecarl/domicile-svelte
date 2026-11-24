<!--
  StatusNotifierItem icons. A click activates an icon, a right-click opens its
  menu, and a middle-click is its secondary action. An application with no
  menu on the bus is asked to show its own.
-->
<script lang="ts">
  import type { Result } from "@cprussin/option-result";
  import type { MenuEntry, WatchedMenu } from "@domicile-desktop/sdk/dbusmenu";
  import type { SystemError } from "@domicile-desktop/sdk/system";
  import type { TrayItem } from "@domicile-desktop/sdk/tray";
  import { BarItem } from "@domicile-svelte/bar";
  import { Menu } from "@domicile-svelte/menu";
  import { useDomicile, watch } from "@domicile-svelte/svelte";
  import { onDestroy } from "svelte";

  import { entriesOf } from "./entries";

  const {
    icon = () => undefined,
    onclose,
  }: {
    /** A theme icon's URL, for menus that name one. */
    icon?: (name: string | undefined) => string | undefined;
    /** A menu closed and gave up the keyboard: hand it back. */
    onclose?: () => void;
  } = $props();

  const { tray } = useDomicile();
  const items = watch(tray, "change", () => tray.items ?? []);
  const anchors: Record<string, HTMLElement> = {};

  let open = $state.raw<{ id: string; title: string; x: number; y: number; watched: WatchedMenu }>();
  let menu = $state.raw<readonly MenuEntry[]>();

  const failed = (error: unknown) => console.error("[bar-tray]", error);
  const sent = (request: Promise<Result<string, SystemError>>) => {
    request.then((result) => result.match({ Err: failed, Ok: () => undefined })).catch(failed);
  };

  const stop = () => {
    open?.watched.stop();
    open = undefined;
    menu = undefined;
  };
  const close = () => {
    stop();
    onclose?.();
  };
  onDestroy(stop);

  const click = (item: TrayItem) => {
    if (item.itemIsMenu || open?.id === item.id) {
      showMenu(item);
    } else {
      tray.activate(item.id, "primary");
    }
  };

  const showMenu = ({ id, title, bus, menu: path }: TrayItem) => {
    if (path === undefined) {
      tray.activate(id, "context");
      return;
    }
    if (open?.id === id) {
      close();
      return;
    }
    stop();
    const box = anchors[id]?.getBoundingClientRect();
    const watched = tray.menu({ bus, path }, (read) =>
      read.match({
        Ok: (entries) => {
          menu = entries;
        },
        Err: (error) => {
          failed(error);
          if (open?.watched === watched) {
            close();
          }
        },
      }),
    );
    open = { id, title, x: box?.left ?? 0, y: box?.bottom ?? 0, watched };
    // Applications fill their menu on this.
    sent(watched.aboutToShow(0));
  };

  // Its application may quit while the menu is open.
  $effect(() => {
    const id = open?.id;
    if (id !== undefined && !items.current.some((item) => item.id === id)) {
      close();
    }
  });
</script>

{#each items.current as item (item.id)}
  <span bind:this={anchors[item.id]}>
    <BarItem
      title={item.title}
      onclick={() => click(item)}
      onauxclick={(event) => event.button === 1 && tray.activate(item.id, "secondary")}
      oncontextmenu={(event) => {
        event.preventDefault();
        showMenu(item);
      }}
    >
      {#if item.icon === undefined}
        {item.title.slice(0, 1)}
      {:else}
        <img src={item.icon} alt={item.title} />
      {/if}
    </BarItem>
  </span>
{/each}

{#if open !== undefined && menu !== undefined}
  {@const { id, title, x, y, watched } = open}
  {#key id}
    <Menu
      entries={entriesOf(menu, {
        click: (entry) => sent(watched.click(entry)),
        show: (entry) => sent(watched.aboutToShow(entry)),
        icon,
      })}
      label={title}
      {x}
      {y}
      trigger={anchors[id]}
      onclose={close}
    />
  {/key}
{/if}

<style>
  span {
    display: inline-flex;
  }

  img {
    width: 20px;
    height: 20px;
  }
</style>
