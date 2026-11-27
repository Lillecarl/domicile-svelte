import { describe, expect, test } from "bun:test";

import { byApp } from "./grouping";

// Newest first, as the history lists them.
const from = (...apps: string[]) => apps.map((appName, id) => ({ appName, id }));

describe("byApp", () => {
  test("puts each app's notifications together, newest first", () => {
    expect(byApp(from("Slack", "Mail", "Slack")).map(({ notifications }) => notifications.map(({ id }) => id))).toEqual(
      [[0, 2], [1]],
    );
  });

  test("orders the groups by their newest notification", () => {
    expect(byApp(from("Mail", "Slack", "Mail")).map(({ app }) => app)).toEqual(["Mail", "Slack"]);
  });

  test("gathers the ones with no app name in a group of their own", () => {
    expect(byApp(from("", "Slack", "")).map(({ app, notifications }) => [app, notifications.length])).toEqual([
      ["", 2],
      ["Slack", 1],
    ]);
  });

  test("has no groups for no notifications", () => {
    expect(byApp([])).toEqual([]);
  });
});
