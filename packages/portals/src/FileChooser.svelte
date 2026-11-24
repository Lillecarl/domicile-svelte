<!--
  An application's file chooser. Typing filters the folder, or names the file
  to save; a typed path (`/…`, `~/…`) is listed as it is typed. Enter opens or chooses,
  Backspace in an empty field goes up, Ctrl+Space marks one of several files.
-->
<script lang="ts">
  import { type FileChooserBody, FileChooserMode, PortalAnswer } from "@domicile-desktop/sdk/portal";
  import { FileType } from "@domicile-desktop/sdk/system";
  import { useDomicile } from "@domicile-svelte/svelte";
  import { untrack } from "svelte";
  import { SvelteMap, SvelteSet } from "svelte/reactivity";

  import { accepts, type Entry, joined, listed, parentOf, placeOf, savable } from "./listing";

  const { body, answer }: { body: FileChooserBody; answer: (answer: PortalAnswer) => void } = $props();

  const { files, windows } = useDomicile();
  // A new request gets a new component, so its body never changes here.
  const asked = untrack(() => body);
  const saving = asked.mode === FileChooserMode.Save;
  const foldersOnly = asked.mode === FileChooserMode.SaveFiles || asked.directory;
  const several = asked.mode === FileChooserMode.Open && asked.multiple && !foldersOnly;
  const accept = asked.acceptLabel ?? (asked.mode === FileChooserMode.Open ? "Open" : "Save");

  // Where a search or a relative path starts. `place` is what is shown.
  let base = $state(asked.currentFolder ?? asked.home);
  let text = $state(saving ? (asked.currentName ?? "") : "");
  let entries = $state<readonly Entry[]>([]);
  let problem = $state<string>();
  let filterAt = $state(asked.currentFilter ?? (asked.filters.length > 0 ? 0 : undefined));
  // The row moved to, until the list changes.
  let selected = $state<number>();
  let replacing = $state<string>();
  const marked = new SvelteSet<string>();
  const choices = new SvelteMap(asked.choices.map((choice) => [choice.id, choice.initial] as const));
  // bind:this sets null, not undefined, when the field goes.
  let input = $state<HTMLInputElement | null>();
  let list = $state<HTMLElement>();

  const filter = $derived(filterAt === undefined ? undefined : asked.filters[filterAt]);
  const place = $derived(placeOf(text, base, asked.home));
  const folder = $derived(place.folder);
  const rows = $derived(listed(entries, { query: saving ? "" : place.query, filter, foldersOnly }));
  // A name typed whole is the row meant, even among longer ones.
  const exact = $derived(rows.findIndex(({ name }) => name === place.query));
  const at = $derived(Math.min(selected ?? Math.max(0, exact), rows.length - 1));

  // A page has the keyboard until the shell takes it.
  $effect(() => {
    if (input !== undefined && input !== null) {
      windows.focusShell();
      input.focus();
      input.select();
    }
  });

  $effect(() => {
    list?.children[at]?.scrollIntoView({ block: "nearest" });
  });

  const isFolder = async (path: string): Promise<boolean> =>
    (await files.stat(path)).match({ Err: () => false, Ok: (stat) => stat.fileType === FileType.Directory });

  // The last folder asked for: a slow listing must not replace a newer one.
  $effect(() => {
    const path = folder;
    let current = true;
    const read = async () => {
      const found = await files.readDir(path);
      const got = await found.match<Promise<Entry[] | string>>({
        Err: async (error) => `Cannot read this folder: ${error.message}`,
        Ok: (all) =>
          Promise.all(
            all.map(async ({ name, fileType }) => ({
              name,
              folder:
                fileType === FileType.Directory || (fileType === FileType.Symlink && (await isFolder(joined(path, name)))),
            })),
          ),
      });
      if (current) {
        entries = typeof got === "string" ? [] : got;
        problem = typeof got === "string" ? got : undefined;
      }
    };
    read().catch((error: unknown) => {
      console.error("[portals]", path, error);
      if (current) {
        entries = [];
        problem = "Cannot read this folder.";
      }
    });
    return () => {
      current = false;
    };
  });

  const go = (path: string) => {
    // A save keeps its name on the way to another folder.
    text = saving ? place.query : "";
    base = path;
    selected = undefined;
    replacing = undefined;
    marked.clear();
    input?.focus();
  };

  const cancel = () => answer(PortalAnswer.Canceled());
  const choose = (paths: readonly string[]) =>
    answer(PortalAnswer.FileChooser({ choices: new Map(choices), currentFilter: filterAt, paths }));

  const open = (entry: Entry) => {
    const path = joined(folder, entry.name);
    if (entry.folder) {
      go(path);
    } else if (saving) {
      base = folder;
      text = entry.name;
      replacing = undefined;
      input?.focus();
    } else {
      choose([path]);
    }
  };

  const toggle = (entry: Entry | undefined) => {
    if (entry !== undefined && !entry.folder) {
      const path = joined(folder, entry.name);
      if (!marked.delete(path)) {
        marked.add(path);
      }
    }
  };

  const save = (path: string, existing: boolean) => {
    if (existing && replacing !== path) {
      replacing = path;
    } else {
      choose([path]);
    }
  };

  // The accept button. A folder chooser takes the folder it shows.
  const confirm = () => {
    if (saving) {
      const name = place.query;
      // Not into a folder that could not be read, which may not be there.
      if (savable(name) && problem === undefined) {
        const clash = entries.find((entry) => entry.name === name);
        if (clash?.folder === true) {
          base = joined(folder, name);
          text = "";
        } else {
          save(joined(folder, name), clash !== undefined);
        }
      }
    } else if (foldersOnly) {
      if (problem === undefined) {
        choose([folder]);
      }
    } else if (marked.size > 0) {
      choose([...marked]);
    } else {
      const row = rows[at];
      if (row !== undefined) {
        open(row);
      }
    }
  };

  // Enter walks into a folder in a folder chooser too; the button chooses.
  const enter = () => {
    const row = rows[at];
    if (foldersOnly && row !== undefined && (place.query !== "" || selected !== undefined)) {
      open(row);
    } else {
      confirm();
    }
  };

  const step = (by: number) => {
    selected = Math.max(0, Math.min(rows.length - 1, at + by));
  };

  const keydown = (event: KeyboardEvent) => {
    const ctrl = event.ctrlKey && !event.altKey && !event.metaKey;
    switch (true) {
      case event.key === "Escape":
        cancel();
        break;
      case event.key === "Enter" && event.target === input:
        enter();
        break;
      case event.key === "ArrowDown" || (ctrl && event.key === "n"):
        step(1);
        break;
      case event.key === "ArrowUp" || (ctrl && event.key === "p"):
        step(-1);
        break;
      case event.key === "Backspace" && text === "" && event.target === input:
        go(parentOf(folder));
        break;
      case ctrl && event.key === " " && several:
        toggle(rows[at]);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const click = (entry: Entry, index: number) => {
    selected = index;
    if (several && !entry.folder) {
      toggle(entry);
    } else {
      open(entry);
    }
  };
</script>

<div class="cover">
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="chooser" role="dialog" aria-label={asked.title} tabindex="-1" onkeydown={keydown}>
    <header>
      <strong>{asked.title || accept}</strong>
      <span class="path" title={folder}>{folder}</span>
    </header>
    <div class="field">
      <button type="button" title="Up" onclick={() => go(parentOf(folder))}>↑</button>
      <button type="button" title="Home" onclick={() => go(asked.home)}>~</button>
      <input
        bind:this={input}
        bind:value={text}
        oninput={() => {
          selected = undefined;
          replacing = undefined;
        }}
        placeholder={saving ? "File name, or a path" : "Search this folder, or type a path"}
        spellcheck="false"
      />
      {#if asked.filters.length > 0}
        <select bind:value={filterAt}>
          {#each asked.filters as { name }, index (index)}<option value={index}>{name}</option>{/each}
        </select>
      {/if}
    </div>
    {#if problem !== undefined}<p class="problem">{problem}</p>{/if}
    <ul bind:this={list}>
      {#each rows as entry, index (entry.name)}
        <li>
          <button
            type="button"
            tabindex="-1"
            class="row"
            class:chosen={index === at && !saving}
            class:marked={marked.has(joined(folder, entry.name))}
            class:dim={saving && !entry.folder && !accepts(filter, entry.name)}
            onclick={() => click(entry, index)}
          >
            <span class="icon">{marked.has(joined(folder, entry.name)) ? "✓" : entry.folder ? "📁" : "📄"}</span>
            <span class="name">{entry.name}</span>
          </button>
        </li>
      {:else}
        <li class="empty">Nothing here</li>
      {/each}
    </ul>
    <footer>
      {#each asked.choices as choice (choice.id)}
        <label>
          {choice.label}
          {#if choice.options.length === 0}
            <input
              type="checkbox"
              checked={choices.get(choice.id) === "true"}
              onchange={(event) => choices.set(choice.id, String(event.currentTarget.checked))}
            />
          {:else}
            <select value={choices.get(choice.id)} onchange={(event) => choices.set(choice.id, event.currentTarget.value)}>
              {#each choice.options as option (option.id)}<option value={option.id}>{option.label}</option>{/each}
            </select>
          {/if}
        </label>
      {/each}
      <span class="note">
        {#if replacing !== undefined}That file exists. {accept} again to replace it.
        {:else if asked.mode === FileChooserMode.SaveFiles}Saves {asked.files.join(", ")}
        {:else if marked.size > 0}{marked.size} marked{/if}
      </span>
      <button type="button" onclick={cancel}>Cancel</button>
      <button type="button" class="accept" class:replace={replacing !== undefined} onclick={confirm}>{accept}</button>
    </footer>
  </div>
</div>

<style>
  .cover {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: grid;
    place-items: center;
    background: #0008;
  }

  .chooser {
    display: flex;
    flex-direction: column;
    width: min(760px, calc(100vw - 32px));
    height: min(560px, calc(100vh - 64px));
    border: 2px solid #74c7ec;
    border-radius: 10px;
    background: #1e1e2e;
    box-shadow: 0 12px 48px #000c;
    overflow: hidden;
    outline: none;
    font: 14px "Hack Nerd Font", monospace;
    color: #cdd6f4;
  }

  header,
  .field,
  footer {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 8px 12px;
  }

  .path {
    overflow: hidden;
    color: #7f849c;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .field {
    border-block: 1px solid #313244;
  }

  .field input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 16px;
    outline: none;
  }

  button,
  select {
    padding: 4px 12px;
    border: 0;
    border-radius: 6px;
    background: #313244;
    color: inherit;
    font: inherit;
  }

  button:hover {
    background: #45475a;
  }

  .problem {
    margin: 0;
    padding: 8px 12px;
    color: #f38ba8;
  }

  ul {
    flex: 1;
    margin: 0;
    padding: 4px;
    list-style: none;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #45475a transparent;
  }

  .row {
    display: flex;
    gap: 10px;
    width: 100%;
    background: transparent;
    text-align: left;
  }

  .row.chosen {
    background: #313244;
  }

  .row.marked {
    color: #a6e3a1;
  }

  .row.dim {
    opacity: 0.5;
  }

  .icon {
    flex: none;
    width: 20px;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty {
    padding: 12px;
    color: #7f849c;
  }

  footer {
    border-top: 1px solid #313244;
  }

  .note {
    flex: 1;
    overflow: hidden;
    color: #f9e2af;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .accept {
    background: #74c7ec;
    color: #1e1e2e;
  }

  .accept.replace {
    background: #f38ba8;
  }
</style>
