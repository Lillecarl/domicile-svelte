import { expect, test } from "bun:test";

import { UnlockRefusal } from "@domicile-desktop/sdk/system";

import { refusalText } from "./refusal";

test("a wrong passphrase says so", () => {
  expect(refusalText({ refusal: UnlockRefusal.WrongPassphrase, failures: 1, retryInMs: 0 }, 0)).toBe(
    "Wrong passphrase.",
  );
});

test("the wait counts down from when the refusal arrived", () => {
  const refused = { refusal: UnlockRefusal.WrongPassphrase, failures: 3, retryInMs: 5000 };
  expect(refusalText(refused, 0)).toBe("Wrong passphrase. Try again in 5 s.");
  expect(refusalText(refused, 3.5)).toBe("Wrong passphrase. Try again in 2 s.");
  expect(refusalText(refused, 5)).toBe("Wrong passphrase.");
});

test("an unverifiable passphrase is not called wrong", () => {
  expect(refusalText({ refusal: UnlockRefusal.Unverifiable, failures: 1, retryInMs: 0 }, 0)).toContain(
    "could not be checked",
  );
});

test("a passphrase sent during the wait says to wait", () => {
  expect(refusalText({ refusal: UnlockRefusal.TooSoon, failures: 3, retryInMs: 2000 }, 0)).toBe(
    "Too many tries. Try again in 2 s.",
  );
});
