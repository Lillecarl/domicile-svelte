<!-- A number for each workspace. A click shows it. -->
<script lang="ts">
  import { BarItem } from "@domicile-svelte/bar";

  const {
    workspaces,
    onpick,
  }: {
    workspaces: readonly { id: number; shown: boolean; empty: boolean }[];
    /** A workspace's number, from 1. */
    onpick: (number: number) => void;
  } = $props();
</script>

{#each workspaces as { id, shown, empty }, at (id)}
  <BarItem title="Workspace {at + 1}" onclick={() => onpick(at + 1)}>
    <span class:shown class:empty aria-current={shown}>{at + 1}</span>
  </BarItem>
{/each}

<style>
  .empty {
    color: #7f849c;
  }

  .shown {
    color: #74c7ec;
    font-weight: bold;
  }
</style>
