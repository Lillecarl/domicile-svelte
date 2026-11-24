<!-- An application installing a launcher. -->
<script lang="ts">
  import { type LauncherBody, LauncherType, PortalAnswer } from "@domicile-desktop/sdk/portal";
  import { untrack } from "svelte";

  import Frame from "./Frame.svelte";

  const { appId, body, answer }: { appId: string; body: LauncherBody; answer: (answer: PortalAnswer) => void } =
    $props();
  let name = $state(untrack(() => body.name));
</script>

<Frame
  title={`${appId || "An application"} asks to install a launcher`}
  accept="Install"
  disabled={name.trim() === ""}
  onaccept={() => answer(PortalAnswer.DynamicLauncher(body.editableName ? name.trim() : body.name))}
  oncancel={() => answer(PortalAnswer.Canceled())}
>
  {#if body.icon !== undefined}<img src={body.icon} alt="" />{/if}
  <label>Name <input bind:value={name} readonly={!body.editableName} /></label>
  <p class="note">
    {body.launcherType === LauncherType.Webapp ? `Opens ${body.target ?? "a web page"}` : "Starts an application"}
  </p>
</Frame>

<style>
  img {
    width: 64px;
    height: 64px;
  }
</style>
