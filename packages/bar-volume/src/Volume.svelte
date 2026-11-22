<!--
  The default output and input. Scroll changes the output by `step`; a click
  runs `mixer`, a right-click `mixerGui`, as the waybar module this ports did.
-->
<script lang="ts">
  import { soundServer } from "@domicile-desktop/system-audio/sound-server";
  import { BarItem } from "@domicile-svelte/bar";
  import { listen, useDomicile } from "@domicile-svelte/svelte";

  const {
    step = 0.01,
    mixer = ["kitty", "--single-instance", "pulsemixer"],
    mixerGui = ["pavucontrol"],
  }: { step?: number; mixer?: string[]; mixerGui?: string[] } = $props();

  const domicile = useDomicile();
  const sound = soundServer(domicile);
  const audio = listen(sound.watch);
  const output = $derived(audio.current?.outputs.find((device) => device.default));
  const input = $derived(audio.current?.inputs.find((device) => device.default && !device.monitor));

  const percent = (volume: number) => `${Math.round(volume * 100)}%`;

  const scrolled = (event: WheelEvent) => {
    if (output !== undefined) {
      const volume = Math.max(0, Math.min(1.5, output.volume - Math.sign(event.deltaY) * step));
      sound
        .setVolume(output.id, volume)
        .catch((error: unknown) => console.error("could not set the volume", error));
    }
  };
  const launch = (argv: string[]) => () => domicile.processes.launch(argv);
  const openGui = (event: MouseEvent) => {
    event.preventDefault();
    domicile.processes.launch(mixerGui);
  };
</script>

{#if output !== undefined}
  <BarItem title={output.description} onclick={launch(mixer)} oncontextmenu={openGui} onwheel={scrolled}>
    <span>{output.muted ? "🔇" : "🔊"} {percent(output.volume)}</span>
    {#if input !== undefined}
      <span title={input.description}>{input.muted ? "" : ""} {percent(input.volume)}</span>
    {/if}
  </BarItem>
{/if}
