<!--
  Browser extensions' actions, as Chrome's toolbar draws them. A click
  activates the extension and opens its popup, if it has one, below the bar.
-->
<script lang="ts">
  import { BarItem } from "@domicile-svelte/bar";
  import { useDomicile, watch } from "@domicile-svelte/svelte";

  import Popup from "./Popup.svelte";

  const { extensions } = useDomicile();
  const list = watch(extensions, "change", () => (extensions.list ?? []).filter(({ enabled }) => enabled));

  let open = $state<{ id: string; url: string; right: number }>();
  const anchors: Record<string, HTMLElement> = {};

  const show = (id: string, url: string) => {
    const box = anchors[id]?.getBoundingClientRect();
    open = { id, url, right: box === undefined ? 0 : Math.max(0, window.innerWidth - box.right) };
  };

  const click = (id: string, popup: string | undefined) => {
    const was = open?.id;
    extensions.activate(id);
    open = undefined;
    if (popup !== undefined && was !== id) {
      show(id, popup);
    }
  };

  $effect(() => extensions.on("popup", ({ id, popup }) => show(id, popup)));
</script>

{#each list.current as extension (extension.id)}
  <span class="action" data-extension-action bind:this={anchors[extension.id]}>
    <BarItem title={extension.title || extension.name} onclick={() => click(extension.id, extension.popup)}>
      <img src={extension.icon} alt={extension.title || extension.name} />
      {#if extension.badgeText !== ""}
        <span class="badge" style:background={extension.badgeColor}>{extension.badgeText}</span>
      {/if}
    </BarItem>
  </span>
{/each}

{#if open !== undefined}
  {#key open}
    <Popup url={open.url} right={open.right} onclose={() => (open = undefined)} />
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
