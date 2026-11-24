<!--
  What applications ask for through xdg-desktop-portal, one at a time, oldest
  first. A screenshot, a color pick or a screen cast comes before the rest. A
  kind this SDK cannot parse is refused, so its application does not wait for
  an answer that never comes. It also fires the chords applications hold.
-->
<script lang="ts">
  import { type CastClaim, CastClaimKind, claimCastRequest } from "@domicile-desktop/sdk/cast";
  import { fireGlobalShortcuts } from "@domicile-desktop/sdk/global-shortcuts";
  import { PortalAnswer, PortalKind, type PortalRequest } from "@domicile-desktop/sdk/portal";
  import { useDomicile, watch } from "@domicile-svelte/svelte";
  import { untrack } from "svelte";

  import Agent from "./Agent.svelte";
  import AppChooser from "./AppChooser.svelte";
  import FileChooser from "./FileChooser.svelte";
  import Frozen from "./Frozen.svelte";
  import Launcher from "./Launcher.svelte";
  import Print from "./Print.svelte";
  import { questionOf } from "./question";
  import ScreenCast from "./ScreenCast.svelte";
  import Shortcuts from "./Shortcuts.svelte";
  import YesNo from "./YesNo.svelte";

  const {
    onclose,
    icon = () => undefined,
    chords = [],
  }: {
    /** A dialog closed and gave up the keyboard: hand it back. */
    onclose?: () => void;
    /** An application's icon, by its desktop file id. */
    icon?: (id: string) => string | undefined;
    /** The chords the shell holds, which an application may not have. */
    chords?: readonly string[];
  } = $props();

  const domicile = useDomicile();
  const { portals } = domicile;
  const requests = watch(portals, "change", () => portals.requests ?? []);

  $effect(() => fireGlobalShortcuts(domicile));

  const CAPTURES = [PortalKind.ScreenCast, PortalKind.Screenshot, PortalKind.PickColor];
  // What a cast to a TV makes of each request: one it answers shows nothing.
  // Before the dialog is drawn, and once a request, as a claim uses itself up.
  let claims = $state.raw<ReadonlyMap<number, CastClaim | undefined>>(new Map());
  $effect.pre(() => {
    const known = untrack(() => claims);
    const next = new Map<number, CastClaim | undefined>();
    for (const request of requests.current) {
      const claim = known.has(request.id) ? known.get(request.id) : claimCastRequest(domicile, request);
      next.set(request.id, claim);
      if (!known.has(request.id) && claim?.kind === CastClaimKind.Answered) {
        portals.answer(request.id, claim.answer);
      }
    }
    claims = next;
  });

  // An inhibitor is no question, and the compositor refuses answers to it.
  const asked = $derived(
    requests.current.filter(
      ({ id, kind }) =>
        kind !== PortalKind.Inhibit &&
        kind !== PortalKind.Unknown &&
        claims.get(id)?.kind !== CastClaimKind.Answered,
    ),
  );
  const shown = $derived<PortalRequest | undefined>(asked.find(({ kind }) => CAPTURES.includes(kind)) ?? asked[0]);

  $effect(() => {
    for (const { id, kind } of requests.current) {
      if (kind === PortalKind.Unknown) {
        portals.answer(id, PortalAnswer.Refused());
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
  {@const { id, appId } = shown}
  {@const answer = (given: PortalAnswer) => portals.answer(id, given)}
  {#key id}
    {#if shown.kind === PortalKind.FileChooser}
      <FileChooser body={shown.body} {answer} />
    {:else if shown.kind === PortalKind.ScreenCast}
      {@const claim = claims.get(id)}
      <ScreenCast
        {appId}
        to={claim?.kind === CastClaimKind.Pick ? claim.to : undefined}
        body={shown.body}
        {answer}
      />
    {:else if shown.kind === PortalKind.AppChooser}
      <AppChooser body={shown.body} {icon} {answer} />
    {:else if shown.kind === PortalKind.DynamicLauncher}
      <Launcher {appId} body={shown.body} {answer} />
    {:else if shown.kind === PortalKind.GlobalShortcuts}
      <Shortcuts {appId} body={shown.body} {chords} {answer} />
    {:else if shown.kind === PortalKind.Agent}
      <Agent body={shown.body} {answer} />
    {:else if shown.kind === PortalKind.Print}
      <Print body={shown.body} {answer} />
    {:else if shown.kind === PortalKind.Screenshot || shown.kind === PortalKind.PickColor}
      <Frozen desk={shown.body} pixel={shown.kind === PortalKind.PickColor} {answer} />
    {:else}
      {@const question = questionOf(shown)}
      {#if question !== undefined}<YesNo {question} {answer} />{/if}
    {/if}
  {/key}
{/if}
