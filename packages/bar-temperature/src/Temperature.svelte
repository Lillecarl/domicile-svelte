<!--
  The CPU's temperature. Nothing is drawn where there is no CPU sensor. While
  the desktop is locked files cannot be read, so the last one stays.
-->
<script lang="ts">
  import { BarItem } from "@domicile-svelte/bar";
  import { useDomicile } from "@domicile-svelte/svelte";

  import { degrees, findSensor, type Reader } from "./sensor";

  const { every = 2000, warm = 80, hot = 90 }: { every?: number; warm?: number; hot?: number } = $props();

  const { files } = useDomicile();
  const reader: Reader = {
    text: async (path) => (await files.readText(path)).unwrapOr(""),
    names: async (directory) => (await files.readDir(directory)).unwrapOr([]).map(({ name }) => name),
  };
  let sensor: string | undefined;
  let celsius = $state<number | undefined>();

  const read = async () => {
    sensor ??= await findSensor(reader);
    if (sensor !== undefined) {
      celsius = degrees(await reader.text(sensor)) ?? celsius;
    }
  };

  const failed = (error: unknown) => console.error("could not read the CPU temperature", error);

  // Polled: sysfs tells nobody when a temperature changes.
  $effect(() => {
    const poll = () => void read().catch(failed);
    poll();
    const timer = setInterval(poll, every);
    return () => clearInterval(timer);
  });
</script>

{#if celsius !== undefined}
  <BarItem title="CPU temperature">
    <span class="temperature" class:warm={celsius >= warm} class:hot={celsius >= hot}>{celsius}°C</span>
  </BarItem>
{/if}

<style>
  .temperature {
    font-variant-numeric: tabular-nums;
  }

  .warm {
    color: #f9e2af;
  }

  .hot {
    color: #f38ba8;
  }
</style>
