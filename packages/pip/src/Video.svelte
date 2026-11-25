<!-- One video: the page's own surface, with controls over it. -->
<script lang="ts">
  import { PICTURE_IN_PICTURE_SHOWN_EVENT } from "@domicile-desktop/sdk/desktop/picture-in-picture";
  import type {
    DomicilePictureInPictureAction,
    DomicilePictureInPictureVideo,
  } from "@domicile-desktop/sdk/domicile-host";
  import { useDomicile } from "@domicile-svelte/svelte";
  import { untrack } from "svelte";

  import { type Box, type Corner, kept, moved, opening, reshaped, resized } from "./box";
  import { clock, playhead } from "./playhead";

  const { video, onclose }: { video: DomicilePictureInPictureVideo; onclose?: (() => void) | undefined } = $props();

  const { pictureInPicture } = useDomicile();
  let screen = $state.raw({ width: innerWidth, height: innerHeight });
  const shape = $derived({ width: video.width, height: video.height });
  let box = $state.raw<Box>(untrack(() => opening(screen, shape)));

  let seen = untrack(() => shape);
  $effect.pre(() => {
    const [now, on] = [shape, screen];
    untrack(() => {
      const isNew = now.width * seen.height !== now.height * seen.width;
      seen = now;
      box = isNew ? reshaped(box, on, now) : kept(box, on);
    });
  });

  const id = $derived(video.id);
  $effect(() => pictureInPicture.resize(id, box.width, box.height));

  // Hidden until it draws, not an empty box.
  let drawn = $state(false);
  const shows = (app: Element) => {
    const show = () => (drawn = true);
    app.addEventListener(PICTURE_IN_PICTURE_SHOWN_EVENT, show);
    return () => app.removeEventListener(PICTURE_IN_PICTURE_SHOWN_EVENT, show);
  };

  const act = (action: DomicilePictureInPictureAction) => {
    pictureInPicture.act(id, action);
    onclose?.();
  };

  let drag: { pointer: number; x: number; y: number; from: Box; corner: Corner | undefined } | undefined;
  const press = (corner?: Corner) => (event: PointerEvent & { currentTarget: HTMLElement }) => {
    if (event.button === 0 && event.target === event.currentTarget) {
      event.currentTarget.setPointerCapture(event.pointerId);
      drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, from: box, corner };
    }
  };
  const follow = (event: PointerEvent) => {
    if (drag?.pointer === event.pointerId) {
      const { x, y, from, corner } = drag;
      const [dx, dy] = [event.clientX - x, event.clientY - y];
      box = corner === undefined ? moved(from, screen, dx, dy) : resized(from, screen, shape, corner, dx);
    }
  };
  const release = () => {
    drag = undefined;
    onclose?.();
  };

  let hovered = $state(false);
  const heard = $derived({
    at: performance.now(),
    duration: video.duration,
    playing: video.playing,
    position: video.position,
    playbackRate: video.playbackRate,
  });
  let now = $state(performance.now());
  $effect(() => {
    if (hovered && video.playing) {
      now = performance.now();
      const ticking = setInterval(() => (now = performance.now()), 500);
      return () => clearInterval(ticking);
    }
    return undefined;
  });
  let held = $state<number>();
  const at = $derived(held ?? playhead(heard, now));

  const CORNERS: readonly Corner[] = [
    { left: true, top: true },
    { left: false, top: true },
    { left: true, top: false },
    { left: false, top: false },
  ];
</script>

<svelte:window onresize={() => (screen = { width: innerWidth, height: innerHeight })} />

<div
  class="video"
  class:drawn
  role="group"
  aria-label="Picture in picture"
  style:translate="{box.x}px {box.y}px"
  style:width="{box.width}px"
  style:height="{box.height}px"
  onpointerenter={() => (hovered = true)}
  onpointerleave={() => (hovered = false)}
>
  <!-- Not a plain <app>: the engine binds a video's surface to the document the
       element is made in, and Svelte makes those in a template's. -->
  <svelte:element this={"app"} class="app" picture-in-picture={id} {@attach shows}></svelte:element>
  <div
    class="controls"
    class:hovered
    role="presentation"
    onpointerdown={press()}
    onpointermove={follow}
    onpointerup={release}
    onpointercancel={release}
  >
    <div class="top">
      <button type="button" title="Back to the page" onclick={() => act("back-to-page")}>{"\u{f02fa}"}</button>
      <button type="button" title="Close" onclick={() => act("close")}>✕</button>
    </div>
    <div class="middle">
      {#if video.canPreviousTrack}
        <button type="button" title="Previous track" onclick={() => act("previous-track")}>{"\u{f04ae}"}</button>
      {/if}
      {#if video.canPlay}
        <button
          type="button"
          title={video.playing ? "Pause" : "Play"}
          onclick={() => act(video.playing ? "pause" : "play")}
        >
          {video.playing ? "\u{f03e4}" : "\u{f040a}"}
        </button>
      {/if}
      {#if video.canNextTrack}
        <button type="button" title="Next track" onclick={() => act("next-track")}>{"\u{f04ad}"}</button>
      {/if}
    </div>
    {#if video.duration > 0}
      <div class="bottom">
        <span>{clock(at)} / {clock(video.duration)}</span>
        <input
          type="range"
          aria-label="Position"
          min="0"
          max={video.duration}
          step="any"
          value={at}
          oninput={({ currentTarget }) => (held = currentTarget.valueAsNumber)}
          onchange={({ currentTarget }) => {
            held = undefined;
            pictureInPicture.seek(id, currentTarget.valueAsNumber);
            onclose?.();
          }}
        />
      </div>
    {/if}
  </div>
  {#each CORNERS as corner (corner)}
    <div
      class="corner"
      class:left={corner.left}
      class:top-edge={corner.top}
      role="presentation"
      onpointerdown={press(corner)}
      onpointermove={follow}
      onpointerup={release}
      onpointercancel={release}
    ></div>
  {/each}
</div>

<style>
  /* Over a fullscreen window, under what opens over windows. */
  .video {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 6;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 8px 32px #000a;
    opacity: 0;
    color: #fff;
    font:
      13px "Hack Nerd Font",
      monospace;
    text-shadow: 0 0 4px #000;
    user-select: none;
  }

  .drawn {
    opacity: 1;
  }

  .app {
    display: block;
    width: 100%;
    height: 100%;
  }

  .controls {
    position: absolute;
    inset: 0;
    background: #0006;
    cursor: move;
    opacity: 0;
  }

  .hovered {
    opacity: 1;
  }

  .top,
  .middle,
  .bottom {
    position: absolute;
    right: 8px;
    left: 8px;
    display: flex;
    gap: 8px;
    align-items: center;
    pointer-events: none;
  }

  .top {
    top: 8px;
    justify-content: space-between;
  }

  .middle {
    top: 50%;
    justify-content: center;
    translate: 0 -50%;
    font-size: 24px;
  }

  .bottom {
    bottom: 8px;
  }

  button,
  input {
    pointer-events: auto;
  }

  input {
    flex: 1;
    min-width: 0;
    accent-color: #74c7ec;
  }

  button {
    padding: 2px 8px;
    border: 0;
    border-radius: 6px;
    background: #0008;
    color: inherit;
    font: inherit;
  }

  button:hover {
    background: #45475a;
  }

  .corner {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 16px;
    height: 16px;
    cursor: nwse-resize;
  }

  .corner.left {
    right: auto;
    left: 0;
    cursor: nesw-resize;
  }

  .corner.top-edge {
    top: 0;
    bottom: auto;
    cursor: nesw-resize;
  }

  .corner.left.top-edge {
    cursor: nwse-resize;
  }
</style>
