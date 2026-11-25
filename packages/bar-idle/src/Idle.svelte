<!-- Keeps the screens on while it is pressed, and names what else does. -->
<script lang="ts">
  import { BarItem } from "@domicile-svelte/bar";
  import { fromListening, holdAwake, listen, useDomicile } from "@domicile-svelte/svelte";

  const { onclicked }: { onclicked?: () => void } = $props();

  const { dbus, session } = useDomicile();
  // The compositor's name for a hold the shell took.
  const SHELL = "domicile";
  const holders = listen(fromListening(() => session.idleHolds(), "what holds the desk awake"));
  const others = $derived((holders.current ?? []).filter((holder) => holder !== SHELL));

  let on = $state(false);
  $effect(() => (on ? holdAwake(dbus, "Kept awake from the bar") : undefined));

  const label = $derived(
    [
      on ? "Kept awake" : "The screens may turn off",
      ...(others.length === 0 ? [] : [`held by ${others.join(", ")}`]),
    ].join(", "),
  );
</script>

<BarItem
  title={label}
  onclick={() => {
    on = !on;
    onclicked?.();
  }}
>
  <span class:on class:held={others.length > 0} aria-label={label}>{on ? "\u{f06e}" : "\u{f070}"}</span>
</BarItem>

<style>
  .held {
    color: #f9e2af;
  }

  .on {
    color: #a6e3a1;
  }
</style>
