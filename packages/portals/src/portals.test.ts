import { describe, expect, test } from "bun:test";
import { PortalAnswer, PortalRequest } from "@domicile-desktop/sdk/portal";

import { draggedArea, framePoint } from "./geometry";
import { pageRanges, pagesText } from "./pages";
import { questionOf } from "./question";

const base = { id: 1, appId: "org.example.App", parentAppId: undefined };
const devices = { keyboard: true, pointer: true, touchscreen: false };

describe("questions", () => {
  test("a remote desktop grant gives what was asked, and is marked", () => {
    const asked = questionOf(PortalRequest.RemoteDesktop(base, { devices, clipboard: true }));
    expect(asked?.danger).toBe(true);
    expect(asked?.lines).toEqual(["Input: keyboard, pointer", "Your clipboard too"]);
    expect(asked?.yes).toEqual(PortalAnswer.RemoteDesktop(devices, true));
  });

  test("an access question keeps the application's own labels", () => {
    const asked = questionOf(
      PortalRequest.Access(base, {
        title: "Use the camera?",
        subtitle: "",
        body: "For a call",
        grantLabel: "Yes",
        denyLabel: undefined,
        destructive: false,
      }),
    );
    expect(asked).toMatchObject({ title: "Use the camera?", lines: ["For a call"], accept: "Yes", deny: "Deny" });
  });

  test("a file chooser is no yes or no question", () => {
    expect(questionOf(PortalRequest.Inhibit(base, { what: [], reason: undefined }))).toBeUndefined();
  });
});

describe("a frozen desk", () => {
  const box = { left: 0, top: 0, width: 100, height: 50 };

  test("a point scales to the frame, and stays on it", () => {
    expect(framePoint({ x: 50, y: 25 }, box, { width: 200, height: 100 })).toEqual({ x: 100, y: 50 });
    expect(framePoint({ x: 500, y: -3 }, box, { width: 200, height: 100 })).toEqual({ x: 199, y: 0 });
  });

  test("a drag covers both its ends, either way", () => {
    expect(draggedArea({ x: 5, y: 9 }, { x: 2, y: 4 })).toEqual({ x: 2, y: 4, width: 4, height: 6 });
  });
});

test("page ranges read and write", () => {
  expect(pageRanges("")).toEqual([]);
  expect(pageRanges("1-3, 5")).toEqual([
    { first: 1, last: 3 },
    { first: 5, last: 5 },
  ]);
  expect(["0", "3-1", "x", "1,"].map(pageRanges)).toEqual([undefined, undefined, undefined, undefined]);
  expect(
    pagesText([
      { first: 1, last: 3 },
      { first: 5, last: 5 },
    ]),
  ).toBe("1-3, 5");
});
