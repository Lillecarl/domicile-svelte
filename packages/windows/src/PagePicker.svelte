<!--
  What a page's color, date or time input, or its text input's suggestions,
  pick from, hung from the control.
-->
<script lang="ts">
  import { useDomicile } from "@domicile-svelte/svelte";
  import { tick, untrack } from "svelte";

  import {
    addDays,
    addMonths,
    day,
    format,
    formatTime,
    type Kind,
    parse,
    parseHex,
    timeParts,
    toHex,
    toHsv,
    weekOf,
    weeksOf,
    within,
  } from "./calendar";

  type Asked = Pick<
    DomicilePickerEvent,
    | "anchorHeight"
    | "anchorWidth"
    | "anchorX"
    | "anchorY"
    | "kind"
    | "labels"
    | "max"
    | "min"
    | "options"
    | "step"
    | "value"
  >;

  const {
    request,
    active,
    onchoose,
    oncancel,
  }: {
    request: Asked;
    /** Whether its window has the keyboard. */
    active: boolean;
    onchoose: (value: string) => void;
    oncancel: () => void;
  } = $props();

  const { windows } = useDomicile();
  let layer = $state<HTMLElement>();
  let card = $state<HTMLElement>();
  let cardWidth = $state(0);
  let cardHeight = $state(0);
  let layerWidth = $state(0);
  let layerHeight = $state(0);

  const GAP = 4;
  const below = $derived(request.anchorY + request.anchorHeight + GAP);
  const above = $derived(request.anchorY - GAP - cardHeight);
  const left = $derived(Math.max(0, Math.min(request.anchorX, layerWidth - cardWidth)));
  const top = $derived(
    below + cardHeight <= layerHeight ? below : above >= 0 ? above : Math.max(0, layerHeight - cardHeight),
  );

  const asked = untrack(() => request);
  const kind = asked.kind;
  const days: Kind | undefined =
    kind === "date" || kind === "datetime-local" || kind === "month" || kind === "week" ? kind : undefined;

  const now = new Date();
  const today = day(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const initial = days === undefined ? undefined : parse(days, asked.value);
  let chosen = $state.raw(initial);
  let cursor = $state.raw(initial ?? today);
  const timed = kind === "time" || kind === "datetime-local";
  const withSeconds = timed && (asked.step === "any" || (asked.step !== "" && Number(asked.step) % 60 !== 0));
  let parts = $state(
    untrack(() => {
      const [hour = 0, minute = 0, second = 0] = timeParts(asked.value);
      return withSeconds ? [hour, minute, second] : [hour, minute];
    }),
  );
  const LIMITS = [23, 59, 59];
  const NAMES = ["Hour", "Minute", "Second"];

  let hsv = $state(toHsv(parseHex(asked.value) ?? "#000000"));
  let typed = $state<string>();
  const hex = $derived(toHex(hsv));

  /** Take the keyboard. */
  export const focus = () => {
    windows.focusShell();
    card?.querySelector<HTMLElement>(".first")?.focus();
  };
  $effect(() => {
    if (card !== undefined) {
      untrack(() => {
        if (active) {
          focus();
        }
      });
    }
  });

  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const pickColor = (event: PointerEvent & { currentTarget: HTMLElement }) => {
    const box = event.currentTarget.getBoundingClientRect();
    typed = undefined;
    hsv = {
      ...hsv,
      saturation: clamp((event.clientX - box.left) / box.width),
      value: clamp(1 - (event.clientY - box.top) / box.height),
    };
  };
  const colorKeys = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowDown: [0, -step],
      ArrowUp: [0, step],
    };
    const by = moves[event.key];
    if (by !== undefined) {
      event.preventDefault();
      typed = undefined;
      hsv = { ...hsv, saturation: clamp(hsv.saturation + by[0]), value: clamp(hsv.value + by[1]) };
    }
  };

  const canTake = (of: Date) => days !== undefined && within(days, of, request.min, request.max);
  const take = (of: Date) => {
    if (days === undefined || !canTake(of)) {
      return;
    }
    cursor = of;
    chosen = of;
    if (days !== "datetime-local") {
      onchoose(format(days, of, ""));
    }
  };
  const turn = (months: number) => (cursor = addMonths(cursor, months));

  // Focus follows the cursor, as in a grid.
  const gridKeys = (event: KeyboardEvent) => {
    const moves: Record<string, () => Date> =
      kind === "month"
        ? {
            ArrowLeft: () => addMonths(cursor, -1),
            ArrowRight: () => addMonths(cursor, 1),
            ArrowUp: () => addMonths(cursor, -3),
            ArrowDown: () => addMonths(cursor, 3),
            PageUp: () => addMonths(cursor, -12),
            PageDown: () => addMonths(cursor, 12),
          }
        : {
            ArrowLeft: () => addDays(cursor, -1),
            ArrowRight: () => addDays(cursor, 1),
            ArrowUp: () => addDays(cursor, -7),
            ArrowDown: () => addDays(cursor, 7),
            PageUp: () => addMonths(cursor, -1),
            PageDown: () => addMonths(cursor, 1),
          };
    const to = moves[event.key];
    if (to !== undefined) {
      event.preventDefault();
      cursor = to();
      void tick().then(() => card?.querySelector<HTMLElement>(".first")?.focus());
    }
  };

  const listKeys = (event: KeyboardEvent & { currentTarget: HTMLElement }) => {
    const by = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (by !== undefined) {
      event.preventDefault();
      const rows = [...event.currentTarget.querySelectorAll<HTMLElement>("button")];
      const at = rows.findIndex((row) => row === document.activeElement);
      rows[Math.max(0, Math.min(rows.length - 1, at + by))]?.focus();
    }
  };

  const done = (event: SubmitEvent) => {
    event.preventDefault();
    const time = formatTime(parts.map((part, at) => Math.max(0, Math.min(LIMITS[at] ?? 0, Math.trunc(part || 0)))));
    if (kind === "color") {
      onchoose(hex);
    } else if (kind === "time") {
      onchoose(time);
    } else if (kind === "datetime-local" && chosen !== undefined) {
      onchoose(format(kind, chosen, time));
    }
  };

  const same = (one: Date | undefined, other: Date) =>
    one !== undefined && days !== undefined && format(days, one, "") === format(days, other, "");
  const titled = (of: Date, month: "long" | "short") => of.toLocaleString("en", { month, timeZone: "UTC" });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="layer"
  class:list={kind === "list"}
  bind:this={layer}
  bind:clientWidth={layerWidth}
  bind:clientHeight={layerHeight}
  onpointerdown={(event) => event.target === layer && oncancel()}
>
  <div
    class="card"
    role="dialog"
    aria-label="Picker"
    tabindex="-1"
    bind:this={card}
    bind:offsetWidth={cardWidth}
    bind:offsetHeight={cardHeight}
    style:left="{left}px"
    style:top="{top}px"
    onkeydown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        oncancel();
      }
    }}
  >
    {#if kind === "list"}
      <!-- svelte-ignore a11y_interactive_supports_focus -->
      <div class="options" role="listbox" style:min-width="{request.anchorWidth}px" onkeydown={listKeys}>
        {#each request.options as option, at (at)}
          <button
            type="button"
            role="option"
            aria-selected="false"
            class:first={at === 0}
            onclick={() => onchoose(option)}
          >
            {option}{#if request.labels[at]}<small>{request.labels[at]}</small>{/if}
          </button>
        {/each}
      </div>
    {:else}
      <form novalidate onsubmit={done}>
        {#if kind === "color"}
          <!-- svelte-ignore a11y_interactive_supports_focus -->
          <div
            class="shade first"
            role="slider"
            tabindex="0"
            aria-label="Saturation and brightness"
            aria-valuenow={Math.round(hsv.saturation * 100)}
            aria-valuetext={hex}
            style:background="linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl({hsv.hue} 100%
            50%))"
            onkeydown={colorKeys}
            onpointerdown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              pickColor(event);
            }}
            onpointermove={(event) => event.currentTarget.hasPointerCapture(event.pointerId) && pickColor(event)}
          >
            <span
              class="thumb"
              style:left="{hsv.saturation * 100}%"
              style:top="{(1 - hsv.value) * 100}%"
              style:background={hex}
            ></span>
          </div>
          <input
            class="hue"
            type="range"
            min="0"
            max="359"
            aria-label="Hue"
            value={hsv.hue}
            oninput={(event) => {
              typed = undefined;
              hsv = { ...hsv, hue: Number(event.currentTarget.value) };
            }}
          />
          {#if request.options.length > 0}
            <div class="swatches">
              {#each request.options as option, at (at)}
                <button
                  type="button"
                  aria-label={request.labels[at] || option}
                  title={request.labels[at] || option}
                  style:background={option}
                  onclick={() => onchoose(parseHex(option) ?? option)}
                ></button>
              {/each}
            </div>
          {/if}
          <div class="row">
            <span class="swatch" style:background={hex}></span>
            <input
              class="hex"
              aria-label="Hex"
              spellcheck="false"
              value={typed ?? hex}
              oninput={(event) => {
                typed = event.currentTarget.value;
                const parsed = parseHex(typed);
                if (parsed !== undefined) {
                  hsv = toHsv(parsed);
                }
              }}
            />
          </div>
        {/if}
        {#if days !== undefined}
          <header class="row">
            <button type="button" aria-label="Before" onclick={() => turn(kind === "month" ? -12 : -1)}>‹</button>
            <span class="title">{kind === "month" ? "" : titled(cursor, "long")} {cursor.getUTCFullYear()}</span>
            <button type="button" aria-label="After" onclick={() => turn(kind === "month" ? 12 : 1)}>›</button>
          </header>
          <div
            class="grid"
            class:months={kind === "month"}
            class:weeks={kind === "week"}
            role="grid"
            tabindex="-1"
            onkeydown={gridKeys}
          >
            {#if kind === "month"}
              {#each { length: 12 }, at (at)}
                {@const of = day(cursor.getUTCFullYear(), at + 1, 1)}
                {@const here = at === cursor.getUTCMonth()}
                <button
                  type="button"
                  class:first={here}
                  class:chosen={same(chosen, of)}
                  tabindex={here ? 0 : -1}
                  disabled={!canTake(of)}
                  onclick={() => take(of)}
                >
                  {titled(of, "short")}
                </button>
              {/each}
            {:else}
              {#if kind === "week"}<span class="name">W</span>{/if}
              {#each ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as name (name)}<span class="name">{name}</span>{/each}
              {#each weeksOf(cursor) as week, at (at)}
                {#if kind === "week"}<span class="name">{weekOf(week[0] ?? cursor).week}</span>{/if}
                {#each week as of (of.getTime())}
                  {@const here = of.getTime() === cursor.getTime()}
                  <button
                    type="button"
                    class:first={here}
                    class:chosen={same(chosen, of)}
                    class:today={of.getTime() === today.getTime()}
                    class:outside={of.getUTCMonth() !== cursor.getUTCMonth()}
                    tabindex={here ? 0 : -1}
                    disabled={!canTake(of)}
                    onclick={() => take(of)}
                  >
                    {of.getUTCDate()}
                  </button>
                {/each}
              {/each}
            {/if}
          </div>
        {/if}
        {#if timed}
          <div class="row time">
            {#each parts as _, at (at)}
              {#if at > 0}:{/if}
              <input
                class:first={kind === "time" && at === 0}
                type="number"
                min="0"
                max={LIMITS[at]}
                aria-label={NAMES[at]}
                bind:value={parts[at]}
                onfocus={(event) => event.currentTarget.select()}
              />
            {/each}
          </div>
        {/if}
        <footer class="row">
          <button type="button" onclick={oncancel}>Cancel</button>
          <span class="space"></span>
          {#if days !== undefined}
            <button type="button" disabled={!canTake(today)} onclick={() => take(today)}>
              {kind === "week" ? "This week" : kind === "month" ? "This month" : "Today"}
            </button>
          {/if}
          {#if kind === "color" || timed}
            <button type="submit" class="done" disabled={kind === "datetime-local" && chosen === undefined}>
              Done
            </button>
          {/if}
        </footer>
      </form>
    {/if}
  </div>
</div>

<style>
  .layer {
    position: absolute;
    inset: 0;
    z-index: 1;
    overflow: hidden;
  }

  .card {
    position: absolute;
    box-sizing: border-box;
    max-width: 100%;
    max-height: 100%;
    padding: 8px;
    border: 1px solid #74c7ec;
    border-radius: 8px;
    background: #1e1e2e;
    box-shadow: 0 8px 24px #000a;
    color: #cdd6f4;
    font:
      13px "Hack Nerd Font",
      monospace;
    outline: none;
    overflow: auto;
  }

  .list .card {
    padding: 4px;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 240px;
  }

  .row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .title {
    flex: 1;
    text-align: center;
    font-weight: bold;
  }

  .space {
    flex: 1;
  }

  button {
    padding: 4px 8px;
    border: 0;
    border-radius: 6px;
    background: #313244;
    color: inherit;
    font: inherit;
  }

  .done,
  .grid .chosen {
    background: #74c7ec;
    color: #1e1e2e;
  }

  button:disabled {
    opacity: 0.4;
  }

  .options {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    max-height: 260px;
    overflow-y: auto;
  }

  .options button {
    display: flex;
    flex-shrink: 0;
    gap: 12px;
    justify-content: space-between;
    background: none;
    text-align: left;
  }

  .options button:hover,
  .options button:focus {
    background: #313244;
  }

  small {
    color: #a6adc8;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    outline: none;
  }

  .grid.weeks {
    grid-template-columns: repeat(8, 1fr);
  }

  .grid.months {
    grid-template-columns: repeat(3, 1fr);
  }

  .grid button {
    background: none;
  }

  .grid button:not(:disabled, .chosen):hover {
    background: #313244;
  }

  .grid .today {
    box-shadow: inset 0 0 0 1px #74c7ec;
  }

  .grid .outside {
    color: #7f849c;
  }

  .name {
    color: #7f849c;
    text-align: center;
  }

  input:not([type="range"]) {
    min-width: 0;
    padding: 4px 8px;
    border: 0;
    border-radius: 6px;
    background: #313244;
    color: inherit;
    font: inherit;
  }

  .hex {
    flex: 1;
  }

  .time {
    justify-content: center;
  }

  .time input {
    width: 4em;
  }

  .shade {
    position: relative;
    height: 150px;
    border-radius: 6px;
    touch-action: none;
  }

  .thumb {
    position: absolute;
    width: 12px;
    height: 12px;
    border: 2px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 2px #000;
    translate: -50% -50%;
    pointer-events: none;
  }

  .hue {
    width: 100%;
    margin: 0;
    appearance: none;
    height: 12px;
    border-radius: 6px;
    background: linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red);
  }

  .hue::-webkit-slider-thumb {
    appearance: none;
    width: 8px;
    height: 16px;
    border: 2px solid #1e1e2e;
    border-radius: 4px;
    background: #fff;
  }

  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .swatches button,
  .swatch {
    width: 22px;
    height: 22px;
    padding: 0;
    border-radius: 4px;
  }

  .card :focus-visible {
    outline: 2px solid #cdd6f4;
  }
</style>
