<!--
  The videos in picture-in-picture, over every window. Drag one to move it, and
  a corner to resize it; its controls show under the pointer. None show while
  locked.
-->
<script lang="ts">
  import { useDomicile, watch } from "@domicile-svelte/svelte";

  import Video from "./Video.svelte";

  const {
    onclose,
  }: {
    /** A video's controls may have taken the keyboard: hand it back. */
    onclose?: () => void;
  } = $props();

  const { pictureInPicture, session } = useDomicile();
  const videos = watch(pictureInPicture, "change", () => pictureInPicture.videos);
  const locked = watch(session, "lockchange", () => session.locked !== false);
</script>

{#if !locked.current}
  <!-- A video's size is 0 until its page says it. -->
  {#each videos.current.filter(({ width, height }) => width > 0 && height > 0) as video (video.id)}
    <Video {video} {onclose} />
  {/each}
{/if}
