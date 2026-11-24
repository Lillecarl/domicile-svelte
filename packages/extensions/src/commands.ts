import { type KeyLike, pressesAccelerator } from "@domicile-desktop/sdk/app-menu";
import type { Extensions } from "@domicile-desktop/sdk/desktop/extensions";
import type { ExtensionCommand } from "@domicile-desktop/sdk/extension";

export type Command = { id: string; command: ExtensionCommand };

type Lists = Pick<Extensions, "commands">;

/** Whether the engine runs extensions' commands: the desktop it hands a shell then has the call. */
export const runsCommands = (extensions: Extensions): boolean => "runCommand" in extensions;

/** Extension `id`'s commands. */
export const commandsOf = (extensions: Lists, id: string): readonly ExtensionCommand[] =>
  extensions.commands?.find((each) => each.id === id)?.commands ?? [];

/** The command whose keys `event` presses. */
export const commandFor = (extensions: Lists, event: KeyLike): Command | undefined =>
  (extensions.commands ?? [])
    .flatMap(({ id, commands }) => commands.map((command) => ({ id, command })))
    .find(({ command: { keys } }) => keys !== undefined && pressesAccelerator(keys, event));
