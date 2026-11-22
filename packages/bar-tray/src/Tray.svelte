<!--
  StatusNotifierItem icons. A click activates an icon; a right-click asks the
  application for its secondary action. Menus (dbusmenu) are not drawn yet.
-->
<script lang="ts">
  import { BarItem } from "@domicile-svelte/bar";
  import { useDomicile, watch } from "@domicile-svelte/svelte";

  const { tray } = useDomicile();
  const items = watch(tray, "change", () => tray.items ?? []);
</script>

{#each items.current as item (item.id)}
  <BarItem
    title={item.title}
    onclick={() => tray.activate(item.id, "primary")}
    oncontextmenu={(event) => {
      event.preventDefault();
      tray.activate(item.id, "secondary");
    }}
  >
    {#if item.icon === undefined}
      {item.title.slice(0, 1)}
    {:else}
      <img src={item.icon} alt={item.title} />
    {/if}
  </BarItem>
{/each}

<style>
  img {
    width: 20px;
    height: 20px;
  }
</style>
