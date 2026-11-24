<!--
  What applications ask for through xdg-desktop-portal, one at a time, oldest
  first. A kind with no dialog here is refused, so its application does not
  wait for an answer that never comes.
-->
<script lang="ts">
  import { PortalAnswer, PortalKind, type PortalRequest } from "@domicile-desktop/sdk/portal";
  import { useDomicile, watch } from "@domicile-svelte/svelte";

  import FileChooser from "./FileChooser.svelte";
  import ScreenCast from "./ScreenCast.svelte";

  const {
    onclose,
  }: {
    /** A dialog closed and gave up the keyboard: hand it back. */
    onclose?: () => void;
  } = $props();

  const { portals } = useDomicile();
  const requests = watch(portals, "change", () => portals.requests ?? []);

  type Drawn = Extract<PortalRequest, { kind: PortalKind.FileChooser | PortalKind.ScreenCast }>;
  const drawn = (request: PortalRequest): request is Drawn =>
    request.kind === PortalKind.FileChooser || request.kind === PortalKind.ScreenCast;
  const shown = $derived(requests.current.find(drawn));

  // Not an inhibitor: that is no question, and the compositor refuses answers to it.
  $effect(() => {
    for (const request of requests.current) {
      if (!drawn(request) && request.kind !== PortalKind.Inhibit) {
        console.warn("[portals] no dialog for", PortalKind[request.kind], "from", request.appId);
        portals.answer(request.id, PortalAnswer.Refused());
      }
    }
  });

  // Also when the application withdraws its request, with no answer from here.
  let wasShown = false;
  $effect(() => {
    const isShown = shown !== undefined;
    if (wasShown && !isShown) {
      onclose?.();
    }
    wasShown = isShown;
  });
</script>

{#if shown !== undefined}
  {@const { id } = shown}
  {#key id}
    {#if shown.kind === PortalKind.FileChooser}
      <FileChooser body={shown.body} answer={(answer) => portals.answer(id, answer)} />
    {:else}
      <ScreenCast appId={shown.appId} body={shown.body} answer={(answer) => portals.answer(id, answer)} />
    {/if}
  {/key}
{/if}
