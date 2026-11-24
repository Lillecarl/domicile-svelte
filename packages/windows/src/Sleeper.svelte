<!-- A page that is not loaded: unloaded to free its memory, or of the last session. -->
<script lang="ts">
  const { page, onwake }: { page: { url: string; title: string }; onwake: () => void } = $props();

  const host = $derived(URL.canParse(page.url) ? new URL(page.url).hostname : page.url);
</script>

<button type="button" onclick={onwake}>
  <span class="title">{page.title || host}</span>
  <span>{host}</span>
</button>

<style>
  button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    height: 100%;
    padding: 16px;
    border: 0;
    background: #181825;
    color: #6c7086;
    font: 13px sans-serif;
    text-align: center;
    overflow-wrap: anywhere;
  }

  .title {
    color: #a6adc8;
    font-size: 16px;
  }
</style>
