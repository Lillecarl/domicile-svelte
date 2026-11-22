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

  // The volume the wheel asked for, until the sound server reports it. Each
  // notch steps from here and not from the reported volume, which lags a
  // pactl run behind: stepping from that made fast scrolling move one step
  // per round trip. The library coalesces the requests that queue up.
  let target = $state<number | undefined>();
  const shown = $derived(target ?? output?.volume ?? 0);

  $effect(() => {
    if (target !== undefined && output !== undefined && Math.abs(output.volume - target) < step / 2) {
      target = undefined;
    }
  });

  const failed = (error: unknown) => {
    console.error("could not set the volume", error);
    target = undefined;
  };

  const scrolled = (event: WheelEvent) => {
    if (output !== undefined && event.deltaY !== 0) {
      const from = target ?? output.volume;
      const volume = Math.round(Math.max(0, Math.min(1.5, from - Math.sign(event.deltaY) * step)) * 100) / 100;
      target = volume;
      sound
        .setVolume(output.id, volume)
        .then((result) => result.match({ Err: failed, Ok: () => undefined }))
        .catch(failed);
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
    <span>{output.muted ? "🔇" : "🔊"} {percent(shown)}</span>
    {#if input !== undefined}
      <span title={input.description}>{input.muted ? "" : ""} {percent(input.volume)}</span>
    {/if}
  </BarItem>
{/if}
