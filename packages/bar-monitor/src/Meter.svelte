<!-- A labelled bar, as htop's. -->
<script lang="ts">
  const { label, value, of, text }: { label: string; value: number; of: number; text: string } = $props();

  const share = $derived(of > 0 ? Math.min(100, (value / of) * 100) : 0);
</script>

<div class="meter" title="{label}: {text}">
  <span class="label">{label}</span>
  <span class="bar"><span class="fill" class:warm={share >= 75} class:hot={share >= 90} style:width="{share}%"></span></span>
  <span class="text">{text}</span>
</div>

<style>
  .meter {
    display: grid;
    grid-template-columns: minmax(2ch, auto) minmax(40px, 1fr) auto;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    color: #74c7ec;
  }

  .bar {
    height: 8px;
    border-radius: 4px;
    background: #313244;
    overflow: hidden;
  }

  .fill {
    display: block;
    height: 100%;
    background: #a6e3a1;
  }

  .warm {
    background: #f9e2af;
  }

  .hot {
    background: #f38ba8;
  }

  .text {
    color: #a6adc8;
  }
</style>
