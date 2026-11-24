import { expect, test } from "bun:test";

import { appIn, externalAppAsk } from "./external-app";

const ask = (app: string | undefined, answers: string[] = [], mayRemember = true) =>
  externalAppAsk(
    {
      url: "zoommtg://zoom.us/join",
      origin: "https://zoom.us",
      mayRemember,
      open: (remember) => answers.push(`open ${remember}`),
      dismiss: () => answers.push("no"),
    },
    app,
  );

test("the application is named, and may be remembered", () => {
  const answers: string[] = [];
  ask("us.zoom.Zoom", answers).accept({ texts: [], choice: 0, ticked: true });
  expect(answers).toEqual(["open true"]);
  expect(ask("us.zoom.Zoom")).toMatchObject({ title: "Open us.zoom.Zoom?", details: ["zoommtg://zoom.us/join"] });
  expect(ask("us.zoom.Zoom", [], false).tick).toBeUndefined();
});

test("no application, nothing opens", () => {
  const answers: string[] = [];
  ask(undefined, answers).accept({ texts: [], choice: 0, ticked: false });
  expect(answers).toEqual(["no"]);
  expect(ask(undefined).message).toContain("zoommtg");
});

test("domicile open says which", () => {
  expect(appIn({ code: 0, stdout: "us.zoom.Zoom.desktop\n" })).toBe("us.zoom.Zoom");
  expect(appIn({ code: 1, stdout: "" })).toBeUndefined();
});
