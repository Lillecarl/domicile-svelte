import { expect, test } from "bun:test";

import { deviceAsk } from "./device";

test("a device is chosen by its id, once any is listed", () => {
  const answers: string[] = [];
  const ask = (listed: boolean, devices: DomicileDevice[]) =>
    deviceAsk({
      title: "site.example wants to connect",
      listed,
      devices: () => devices,
      choose: (ids) => answers.push(`choose ${ids.join()}`),
      cancel: () => answers.push("cancel"),
    });
  expect(ask(false, []).message).toContain("Looking");
  expect(ask(true, []).message).toContain("No device");
  const found = ask(true, [{ id: 7, name: "Nano X" }]);
  expect(found).toMatchObject({ choices: [{ value: 7, label: "Nano X" }] });
  expect(found.picked).toBeUndefined();
  const answer = { texts: [], choice: 7, ticked: false };
  found.accept(answer);
  found.dismiss(answer);
  expect(answers).toEqual(["choose 7", "cancel"]);
});
