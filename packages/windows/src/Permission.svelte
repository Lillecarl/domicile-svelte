<!-- A site asks for a permission. Over the page, which cannot draw over it. -->
<script lang="ts">
  export type Request = {
    site: string;
    asks: string;
    /** Allow or block the site, stored for it. */
    allow: () => void;
    deny: () => void;
    /** Close without choosing; nothing is stored. */
    dismiss: () => void;
  };

  const { request }: { request: Request } = $props();

  // A click meant for the page must not land on a button that just appeared.
  const HOLD_MS = 500;
  let ready = $state(false);
  $effect(() => {
    void request;
    ready = false;
    const timer = setTimeout(() => (ready = true), HOLD_MS);
    return () => clearTimeout(timer);
  });
</script>

<div class="permission" role="alertdialog" aria-label="Permission request">
  <span class="words"><strong>{request.site}</strong> asks to {request.asks}</span>
  <button type="button" class="allow" disabled={!ready} onclick={request.allow}>Allow</button>
  <button type="button" disabled={!ready} onclick={request.deny}>Block</button>
  <button type="button" aria-label="Not now" title="Not now" onclick={request.dismiss}>✕</button>
</div>

<style>
  .permission {
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    max-width: 640px;
    margin: 0 auto;
    padding: 8px 12px;
    border: 1px solid #f9e2af;
    border-radius: 8px;
    background: #1e1e2e;
    box-shadow: 0 8px 24px #000a;
    color: #cdd6f4;
    font:
      13px "Hack Nerd Font",
      monospace;
  }

  .words {
    flex: 1;
    min-width: 12em;
    overflow-wrap: anywhere;
  }

  button {
    padding: 3px 12px;
    border: 0;
    border-radius: 6px;
    background: #313244;
    color: inherit;
    font: inherit;
  }

  button:not(:disabled):hover {
    background: #45475a;
  }

  .allow {
    background: #a6e3a1;
    color: #1e1e2e;
  }

  .allow:not(:disabled):hover {
    background: #94e2d5;
  }

  button:disabled {
    opacity: 0.5;
  }
</style>
