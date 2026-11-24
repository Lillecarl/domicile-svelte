import { expect, test } from "bun:test";

import { dialogAsk, hostOf } from "./ask";

const dialog = (dialogType: string, answers: string[] = []) =>
  dialogAsk({
    dialogType,
    origin: "https://example.com",
    message: "Sure?",
    defaultValue: "me",
    accept: (value) => answers.push(`yes ${value ?? ""}`),
    dismiss: () => answers.push("no"),
  });
const answer = { texts: ["you"], choice: 0, ticked: false };

test("an alert has only OK", () => {
  expect(dialog("alert")).toMatchObject({ title: "example.com says", message: "Sure?", yes: "OK" });
  expect(dialog("alert")?.no).toBeUndefined();
});

test("a prompt answers with its text, and the others with none", () => {
  const answers: string[] = [];
  expect(dialog("prompt", answers)?.fields?.[0]?.value).toBe("me");
  dialog("prompt", answers)?.accept(answer);
  dialog("confirm", answers)?.accept(answer);
  dialog("confirm", answers)?.dismiss();
  expect(answers).toEqual(["yes you", "yes ", "no"]);
});

test("a page that asks to stay has no words of its own", () => {
  expect(dialog("beforeunload")).toMatchObject({ title: "Leave site?", yes: "Leave", no: "Stay" });
});

test("a dialog unknown here is not claimed", () => {
  expect(dialog("sing")).toBeUndefined();
});

test("a frame with no site has no host", () => {
  expect(hostOf("null")).toBeUndefined();
  expect(hostOf("")).toBeUndefined();
  expect(hostOf("https://a.example:8080")).toBe("a.example:8080");
});
