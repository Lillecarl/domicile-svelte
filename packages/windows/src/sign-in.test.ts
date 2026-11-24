import { expect, test } from "bun:test";
import type { WebViewIdentityAccount, WebViewIdentityStep } from "@domicile-desktop/sdk/webview-element";

import { promptAsk } from "./prompt";
import { identityAsk, signInAsk } from "./sign-in";

const answer = { texts: ["me", "secret"], choice: 1, ticked: false };

test("a sign-in sends both texts, and says when they cross the network open", () => {
  const sent: string[] = [];
  const ask = (secure: boolean) =>
    signInAsk({
      url: "http://a.example/",
      proxy: false,
      secure,
      signIn: (name, password) => sent.push(`${name}:${password}`),
      dismiss: () => undefined,
    });
  ask(true).accept(answer);
  expect(sent).toEqual(["me:secret"]);
  expect(ask(true).message).not.toContain("not private");
  expect(ask(false).message).toContain("not private");
});

const account = (name: string, more: Partial<WebViewIdentityAccount> = {}): WebViewIdentityAccount => ({
  provider: 0,
  name,
  identifier: `${name}@example.com`,
  picture: "",
  returning: true,
  shared: [],
  ...more,
});
const identity = (step: WebViewIdentityStep, accounts: WebViewIdentityAccount[], answers: string[] = []) =>
  identityAsk({
    step,
    button: false,
    site: "site.example",
    purpose: "sign-in",
    errorUrl: "",
    providers: () => [
      {
        name: "id.example",
        icon: "",
        privacyPolicy: "https://site.example/privacy",
        termsOfService: "",
        signedOut: false,
        addAccount: true,
      },
    ],
    accounts: () => accounts,
    choose: (at) => answers.push(`choose ${at}`),
    signInToProvider: (at) => answers.push(`provider ${at}`),
    moreDetails: () => answers.push("more"),
    dismiss: () => answers.push("no"),
  });

test("an account is chosen, or another added", () => {
  const answers: string[] = [];
  const ask = identity("accounts", [account("Ann"), account("Bo")], answers);
  expect(ask).toMatchObject({ aside: true, picked: 0, yes: "Continue" });
  ask.accept(answer);
  ask.extra?.[0]?.run();
  expect(answers).toEqual(["choose 1", "provider 0"]);
});

test("what is shared the first time is said", () => {
  const ask = identity("accounts", [account("Ann B", { shared: ["name", "email"] })]);
  expect(ask.yes).toBe("Continue as Ann");
  expect(ask.note).toContain("name and email address");
  expect(ask.links?.map(({ label }) => label)).toEqual(["Privacy policy"]);
});

test("a step that takes no answer has none", () => {
  const ask = identity("verifying", [account("Ann")]);
  expect([ask.yes, ask.no]).toEqual([undefined, undefined]);
});

test("a certificate is chosen by its place", () => {
  const answers: string[] = [];
  const ask = promptAsk({
    kind: "client-certificate",
    origin: "https://bank.example",
    subject: "",
    details: ["Me\nCA", "Other"],
    pin: "",
    accept: (choice, text) => answers.push(`${choice} ${text ?? ""}`),
    dismiss: () => answers.push("no"),
  });
  expect(ask?.choices).toEqual([
    { value: 0, label: "Me", detail: "Issued by CA" },
    { value: 1, label: "Other" },
  ]);
  ask?.accept(answer);
  expect(answers).toEqual(["1 "]);
});
