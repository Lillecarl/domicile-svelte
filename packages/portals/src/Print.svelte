<!-- A printer and its options, or a PDF file. An option the printer does not offer is not shown. -->
<script lang="ts">
  import {
    ColorMode,
    FileChooserMode,
    Orientation,
    PortalAnswer,
    PortalAnswerKind,
    type PrintBody,
    type Printer,
    type PrintOptions,
    PrintQuality,
    Sides,
  } from "@domicile-desktop/sdk/portal";
  import { untrack } from "svelte";

  import FileChooser from "./FileChooser.svelte";
  import Frame from "./Frame.svelte";
  import { pageRanges, pagesText } from "./pages";

  const { body, answer }: { body: PrintBody; answer: (answer: PortalAnswer) => void } = $props();
  const asked = untrack(() => body);
  // The PDF is last, and is no CUPS queue even when one has its name.
  const printers: readonly Printer[] = [...asked.printers, asked.pdf];

  let at = $state(Math.max(0, asked.printers.findIndex(({ name }) => name === asked.printer)));
  const printer = $derived(printers[at] ?? asked.pdf);
  const toPdf = $derived(at === printers.length - 1);
  let options = $state<PrintOptions>({ ...(printers[untrack(() => at)] ?? asked.pdf).initial });
  let pages = $state(untrack(() => pagesText(options.pages)));
  let saving = $state(false);

  const pick = (index: number) => {
    at = index;
    options = { ...(printers[index] ?? asked.pdf).initial };
    pages = pagesText(options.pages);
  };

  const ranges = $derived(printer.pageRanges ? pageRanges(pages) : []);
  const copiesFine = $derived(
    Number.isInteger(options.copies) && options.copies >= 1 && options.copies <= Math.max(1, printer.copiesMax),
  );
  const chosen = (): PrintOptions => ({ ...$state.snapshot(options), pages: ranges ?? [] });

  const words = (name: string) => name.replace(/(?!^)([A-Z])/g, " $1").toLowerCase();
</script>

{#snippet choice<T extends number>(label: string, offered: readonly T[], names: Record<number, string>, value: T | undefined, set: (value: T) => void)}
  {#if offered.length > 0}
    <label>
      {label}
      <select
        value={String(value ?? "")}
        onchange={(event) => {
          const found = offered.find((each) => String(each) === event.currentTarget.value);
          if (found !== undefined) {
            set(found);
          }
        }}
      >
        {#if value === undefined}<option value="">printer's default</option>{/if}
        {#each offered as each (each)}<option value={String(each)}>{words(names[each] ?? "")}</option>{/each}
      </select>
    </label>
  {/if}
{/snippet}

{#if saving}
  <FileChooser
    body={{
      acceptLabel: "Save",
      choices: [],
      currentFilter: undefined,
      currentFolder: undefined,
      currentName: `${asked.title.replaceAll("/", "-") || "document"}.pdf`,
      directory: false,
      files: [],
      filters: [],
      home: asked.home,
      mode: FileChooserMode.Save,
      multiple: false,
      title: "Save as PDF",
    }}
    answer={(given) => {
      const path = given.kind === PortalAnswerKind.FileChooser ? given.chosen.paths[0] : undefined;
      if (path === undefined) {
        saving = false;
      } else {
        answer(PortalAnswer.SaveToPdf(path, chosen()));
      }
    }}
  />
{:else}
  <Frame
    title={`Print ${asked.title}`}
    accept={toPdf ? "Save…" : (asked.acceptLabel ?? "Print")}
    eager
    disabled={ranges === undefined || !copiesFine}
    onaccept={() => (toPdf ? (saving = true) : answer(PortalAnswer.Print(printer.name, chosen())))}
    oncancel={() => answer(PortalAnswer.Canceled())}
  >
    <label>
      Printer
      <select value={String(at)} onchange={(event) => pick(Number(event.currentTarget.value))}>
        {#each printers as each, index (index)}
          <option value={String(index)}>{each.description ?? each.name}</option>
        {/each}
      </select>
    </label>
    {#if printer.copiesMax > 1}
      <label>Copies <input type="number" min="1" max={printer.copiesMax} bind:value={options.copies} /></label>
    {/if}
    {#if printer.pageRanges}
      <label>Pages <input bind:value={pages} placeholder="all, or 1-3, 5" class:bad={ranges === undefined} /></label>
    {/if}
    {#if printer.media.length > 0}
      <label>
        Paper
        <select bind:value={options.media}>
          {#if options.media === undefined}<option value={undefined}>printer's default</option>{/if}
          {#each printer.media as { name, label } (name)}<option value={name}>{label}</option>{/each}
        </select>
      </label>
    {/if}
    {@render choice("Color", printer.colorModes, ColorMode, options.colorMode, (value) => (options.colorMode = value))}
    {@render choice("Sides", printer.sides, Sides, options.sides, (value) => (options.sides = value))}
    {@render choice("Orientation", printer.orientations, Orientation, options.orientation, (value) => (options.orientation = value))}
    {@render choice("Quality", printer.qualities, PrintQuality, options.quality, (value) => (options.quality = value))}
  </Frame>
{/if}
