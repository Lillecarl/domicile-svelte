import { expect, test } from "bun:test";

import { problemOf } from "./problem";

const page = (more: Partial<Parameters<typeof problemOf>[0]>) =>
  problemOf({
    pageFailure: "",
    pageFailureCanProceed: false,
    pageFailureError: "",
    pageFailureHttpStatus: 0,
    pageFailureUrl: "https://site.example/a",
    renderProcessGone: "",
    ...more,
  });

test("a page that loaded has no problem", () => {
  expect(page({})).toBeUndefined();
});

test("a crash comes before a failure", () => {
  expect(page({ renderProcessGone: "oom", pageFailure: "network" })?.title).toContain("memory");
  expect(page({ renderProcessGone: "killed" })).toMatchObject({ title: "This page crashed", code: "killed" });
});

test("a failure names the site and the error", () => {
  expect(page({ pageFailure: "network", pageFailureError: "ERR_CONNECTION_REFUSED" })).toMatchObject({
    title: "Cannot reach site.example",
    code: "ERR_CONNECTION_REFUSED",
  });
  expect(page({ pageFailure: "http", pageFailureHttpStatus: 502 })?.code).toBe("HTTP 502");
});

test("a warning says what going on risks", () => {
  expect(page({ pageFailure: "certificate", pageFailureCanProceed: true })).toMatchObject({ canProceed: true });
  expect(page({ pageFailure: "certificate" })?.warning).toBeDefined();
  expect(page({ pageFailure: "network" })?.warning).toBeUndefined();
});
