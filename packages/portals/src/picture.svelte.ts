import { useDomicile } from "@domicile-svelte/svelte";

const TYPES: Readonly<Record<string, string>> = { svg: "image/svg+xml", png: "image/png", webp: "image/webp" };

/** A URL of the picture at the path `read` gives, once it is read; `undefined` before, and for none. */
export const picture = (read: () => string | undefined): { readonly url: string | undefined } => {
  const { files } = useDomicile();
  let url = $state<string>();
  $effect(() => {
    const path = read();
    let made: string | undefined;
    let current = true;
    if (path !== undefined) {
      files
        .read(path)
        .then((found) =>
          found.match({
            Err: (error) => console.error("[portals]", path, error),
            Ok: (bytes) => {
              if (current) {
                const type = TYPES[path.slice(path.lastIndexOf(".") + 1).toLowerCase()] ?? "image/jpeg";
                made = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }));
                url = made;
              }
            },
          }),
        )
        .catch((error: unknown) => console.error("[portals]", path, error));
    }
    return () => {
      current = false;
      url = undefined;
      if (made !== undefined) {
        URL.revokeObjectURL(made);
      }
    };
  });
  return {
    get url() {
      return url;
    },
  };
};
