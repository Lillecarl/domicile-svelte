import type { Result } from "@cprussin/option-result";
import type { Listening } from "@domicile-desktop/sdk/system";
import { createSubscriber } from "svelte/reactivity";

/** Calls `onValue` now and on each change, and returns a function that stops. */
export type Watch<Value> = (onValue: (value: Value) => void) => () => void;

/**
 * The latest value `watch` gave, `undefined` before the first.
 *
 * The domicile system libraries (`soundServer(domicile).watch`, ...) all have
 * this shape. The watch runs while an effect reads `current`.
 */
export const listen = <Value>(watch: Watch<Value>): { readonly current: Value | undefined } => {
  let latest = $state<Value | undefined>();
  const subscribe = createSubscriber(() =>
    watch((value) => {
      latest = value;
    }),
  );
  return {
    get current() {
      subscribe();
      return latest;
    },
  };
};

/**
 * A {@link Watch} over a desktop call that answers with a stream, such as
 * `keyboard.keymaps`. A failure to start or a broken stream is logged, and the
 * value stays at the last one heard.
 */
export const fromListening =
  <Value, Failure extends {}>(start: () => Promise<Result<Listening<Value>, Failure>>, what: string): Watch<Value> =>
  (onValue) => {
    const failed = (error: unknown) => {
      console.error(`could not watch ${what}`, error);
    };
    const started = start().then((result) =>
      result.match<Listening<Value> | undefined>({
        Err: (error) => {
          failed(error);
          return undefined;
        },
        Ok: (listening) => {
          eachOf(listening.items, onValue).catch(failed);
          return listening;
        },
      }),
    );
    return () => {
      started.then((listening) => listening?.stop()).catch(failed);
    };
  };

const eachOf = async <T>(items: ReadableStream<T>, each: (item: T) => void): Promise<void> => {
  for await (const item of items) {
    each(item);
  }
};
