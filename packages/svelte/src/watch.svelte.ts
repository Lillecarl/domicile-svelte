import { createSubscriber } from "svelte/reactivity";

/** Anything in the desktop API with an `on(event, listener)` that returns its unlisten. */
type Source<Event extends string> = {
  on: (event: Event, listener: () => void) => () => void;
};

/**
 * A value read from `source` that reruns its readers on `event`.
 *
 * The Svelte counterpart of `@domicile-desktop/react`'s `useWatch`: the
 * listener is attached while an effect reads `current`, and removed after.
 */
export const watch = <Event extends string, Value>(
  source: Source<Event>,
  event: Event,
  read: () => Value,
): { readonly current: Value } => {
  const subscribe = createSubscriber((update) => source.on(event, update));
  return {
    get current() {
      subscribe();
      return read();
    },
  };
};
