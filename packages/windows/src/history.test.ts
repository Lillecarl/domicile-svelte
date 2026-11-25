import { expect, test } from "bun:test";

import { historyMenu } from "./history";

const page = (id: number, title = `page ${id}`, favicon = "") => ({ id, title, favicon, url: `https://x/${id}` });

test("a page by its title, or its address, with its icon", () => {
  const [named, unnamed] = historyMenu([page(1, "One", "data:,"), page(2, "")], () => undefined);
  expect(named).toMatchObject({ label: "One", image: "data:," });
  expect(unnamed).toMatchObject({ label: "https://x/2" });
  expect(unnamed).not.toHaveProperty("image");
});

test("a choice goes to its page", () => {
  const gone: number[] = [];
  const [entry] = historyMenu([page(7)], (id) => gone.push(id));
  if (entry?.kind === "item") {
    entry.run?.();
  }
  expect(gone).toEqual([7]);
});

test("a long history is cut", () => {
  expect(
    historyMenu(
      Array.from({ length: 30 }, (_, id) => page(id)),
      () => undefined,
    ),
  ).toHaveLength(12);
});
