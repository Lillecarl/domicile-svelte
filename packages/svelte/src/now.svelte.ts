import { createSubscriber } from "svelte/reactivity";

/** The current time, rerunning its readers every `intervalMs` while read. */
export const now = (intervalMs = 1000): { readonly current: Date } => {
  const subscribe = createSubscriber((update) => {
    const timer = setInterval(update, intervalMs);
    return () => clearInterval(timer);
  });
  return {
    get current() {
      subscribe();
      return new Date();
    },
  };
};
