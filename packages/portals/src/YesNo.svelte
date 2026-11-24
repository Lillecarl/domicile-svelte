<script lang="ts">
  import { PortalAnswer } from "@domicile-desktop/sdk/portal";

  import Frame from "./Frame.svelte";
  import { picture } from "./picture.svelte";
  import type { Question } from "./question";

  const { question, answer }: { question: Question; answer: (answer: PortalAnswer) => void } = $props();
  const shown = picture(() => question.picture);
</script>

<Frame
  title={question.title}
  accept={question.accept}
  deny={question.deny}
  danger={question.danger}
  onaccept={() => answer(question.yes)}
  oncancel={() => answer(PortalAnswer.Canceled())}
>
  {#if shown.url !== undefined}<img src={shown.url} alt="" />{/if}
  {#each question.lines as line, index (index)}<p>{line}</p>{/each}
</Frame>

<style>
  img {
    align-self: center;
    max-width: 100%;
    max-height: 320px;
    border-radius: 6px;
  }
</style>
