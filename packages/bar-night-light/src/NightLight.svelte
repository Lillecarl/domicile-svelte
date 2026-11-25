<!-- Warmer screens while it is pressed; a reloaded shell keeps it. -->
<script lang="ts">
  import { BarItem } from "@domicile-svelte/bar";
  import { useDomicile } from "@domicile-svelte/svelte";

  const {
    kelvin = 4000,
    onclicked,
  }: {
    /** The white of the screens while it is on, 1000 to 6500. */
    kelvin?: number;
    onclicked?: () => void;
  } = $props();

  const { displays } = useDomicile();
  // Colors as they are.
  const PLAIN = 6500;
  const ON = "night-light.on";

  const set = (white: number) => {
    displays
      .setColorTemperature(white)
      .then((done) => done.match({ Ok: () => undefined, Err: (error) => console.error("[night-light]", error) }))
      .catch((error: unknown) => console.error("[night-light]", error));
  };

  let on = $state(localStorage.getItem(ON) !== null);
  // The engine keeps no temperature over a restart of the desktop.
  $effect(() => {
    if (on) {
      set(kelvin);
    }
  });

  /** Turn the night light on or off. */
  export const toggle = () => {
    on = !on;
    if (on) {
      localStorage.setItem(ON, "");
    } else {
      localStorage.removeItem(ON);
      set(PLAIN);
    }
  };
</script>

<BarItem
  title={on ? "Night light, on" : "Night light, off"}
  onclick={() => {
    toggle();
    onclicked?.();
  }}
>
  <span class:on aria-label="Night light" aria-pressed={on}>{"\u{f0594}"}</span>
</BarItem>

<style>
  .on {
    color: #fab387;
  }
</style>
