<!--
  A frame of the desk to pick from: a drag takes an area and a click a
  monitor, or with `pixel` a click takes one pixel. Escape cancels.
-->
<script lang="ts">
  import { type FrozenDesk, PortalAnswer } from "@domicile-desktop/sdk/portal";
  import { useDomicile } from "@domicile-svelte/svelte";

  import { draggedArea, framePoint } from "./geometry";

  const { desk, pixel, answer }: { desk: FrozenDesk; pixel: boolean; answer: (answer: PortalAnswer) => void } =
    $props();

  const { windows } = useDomicile();
  let cover = $state<HTMLElement | null>();
  let image = $state<HTMLImageElement | null>();
  let from = $state<{ x: number; y: number }>();
  let to = $state<{ x: number; y: number }>();
  let copy = $state(false);
  const area = $derived(from !== undefined && to !== undefined && !pixel ? draggedArea(from, to) : undefined);

  // A page has the keyboard until the shell takes it.
  $effect(() => {
    if (cover !== undefined && cover !== null) {
      windows.focusShell();
      cover.focus();
    }
  });

  const at = (event: PointerEvent) =>
    image === undefined || image === null
      ? undefined
      : framePoint({ x: event.clientX, y: event.clientY }, image.getBoundingClientRect(), desk);

  const down = (event: PointerEvent) => {
    if (event.button === 0) {
      from = at(event);
      to = from;
      image?.setPointerCapture(event.pointerId);
    }
  };
  const move = (event: PointerEvent) => {
    if (from !== undefined) {
      to = at(event);
    }
  };
  const up = () => {
    if (from === undefined) {
      return;
    }
    const start = from;
    const taken = area;
    from = undefined;
    to = undefined;
    if (pixel) {
      answer(PortalAnswer.PickColor(start));
    } else if (taken !== undefined && taken.width > 4 && taken.height > 4) {
      answer(PortalAnswer.Screenshot(taken, copy));
    } else {
      const monitor = desk.monitors.find(
        ({ area: { x, y, width, height } }) =>
          start.x >= x && start.x < x + width && start.y >= y && start.y < y + height,
      );
      if (monitor !== undefined) {
        answer(PortalAnswer.Screenshot(monitor.area, copy));
      }
    }
  };

  const percent = (part: number, whole: number) => `${(100 * part) / whole}%`;
  const cancel = () => answer(PortalAnswer.Canceled());
</script>

<div
  bind:this={cover}
  class="cover"
  role="dialog"
  aria-label={pixel ? "Pick a color" : "Take a screenshot"}
  tabindex="-1"
  onkeydown={(event) => event.key === "Escape" && cancel()}
>
  <div
    class="frame"
    style:left={`${desk.desk.position[0]}px`}
    style:top={`${desk.desk.position[1]}px`}
    style:width={`${desk.desk.size[0]}px`}
    style:height={`${desk.desk.size[1]}px`}
  >
    <img
      bind:this={image}
      src={desk.frame}
      alt=""
      draggable="false"
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
    />
    {#if area !== undefined}
      <div
        class="area"
        style:left={percent(area.x, desk.width)}
        style:top={percent(area.y, desk.height)}
        style:width={percent(area.width, desk.width)}
        style:height={percent(area.height, desk.height)}
      ></div>
    {/if}
  </div>
  <div class="bar">
    {#if pixel}
      <span>Click a pixel</span>
    {:else}
      <span>Drag an area, or click for a monitor</span>
      <label><input type="checkbox" bind:checked={copy} /> Copy</label>
      {#each desk.windows as { id, title, appId } (id)}
        <button type="button" onclick={() => answer(PortalAnswer.ScreenshotWindow(id, copy))}>{title || appId}</button>
      {/each}
    {/if}
    <button type="button" onclick={cancel}>Cancel</button>
  </div>
</div>

<style>
  .cover {
    position: fixed;
    inset: 0;
    z-index: 40;
    outline: none;
    background: #000;
    cursor: crosshair;
  }

  .frame {
    position: absolute;
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
  }

  .area {
    position: absolute;
    border: 2px solid #74c7ec;
    background: #74c7ec33;
    box-sizing: border-box;
    pointer-events: none;
  }

  .bar {
    position: absolute;
    bottom: 24px;
    left: 50%;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    max-width: calc(100vw - 48px);
    padding: 8px 12px;
    translate: -50% 0;
    border: 2px solid #74c7ec;
    border-radius: 10px;
    background: #1e1e2e;
    color: #cdd6f4;
    font:
      14px "Hack Nerd Font",
      monospace;
    cursor: default;
  }

  button {
    max-width: 220px;
    padding: 4px 12px;
    border: 0;
    border-radius: 6px;
    background: #313244;
    color: inherit;
    font: inherit;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
