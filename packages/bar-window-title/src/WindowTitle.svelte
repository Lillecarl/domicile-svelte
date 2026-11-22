<script lang="ts">
  import { BarItem } from "@domicile-svelte/bar";
  import { useDomicile, watch } from "@domicile-svelte/svelte";

  const { windows } = useDomicile();
  const list = watch(windows, "change", () => windows.list);
  const focused = watch(windows, "focuschange", () => windows.focused);
  const title = $derived(list.current.find((window) => window.appId === focused.current)?.title);
</script>

{#if title !== undefined && title !== ""}
  <BarItem {title}><span class="title">{title}</span></BarItem>
{/if}

<style>
  .title {
    max-width: 60ch;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
