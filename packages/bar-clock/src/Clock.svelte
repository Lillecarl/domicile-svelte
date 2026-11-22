<script lang="ts">
  import { BarItem } from "@domicile-svelte/bar";
  import { now } from "@domicile-svelte/svelte";

  const clock = now();
  const pad = (n: number) => String(n).padStart(2, "0");
  const text = $derived.by(() => {
    const t = clock.current;
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
  });
  const title = $derived(clock.current.toLocaleDateString(undefined, { dateStyle: "full" }));
</script>

<BarItem {title}><span class="clock">{text}</span></BarItem>

<style>
  .clock {
    font-variant-numeric: tabular-nums;
  }
</style>
