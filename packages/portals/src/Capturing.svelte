<!-- Each application that records the screen or controls input. A click stops it. -->
<script lang="ts">
  import { CapturingKind } from "@domicile-desktop/sdk/portal";
  import { BarItem } from "@domicile-svelte/bar";
  import { useDomicile, watch } from "@domicile-svelte/svelte";

  const { portals } = useDomicile();
  const sessions = watch(portals, "change", () => portals.capturing ?? []);
</script>

{#each sessions.current as session (session.id)}
  <BarItem
    title={`${session.appId || "An application"}: ${CapturingKind[session.kind]}. Click to stop.`}
    onclick={() => portals.stopCapturing(session.id)}
  >
    <span class="live">● {session.appId || "sharing"}</span>
  </BarItem>
{/each}

<style>
  .live {
    color: #f38ba8;
  }
</style>
