import { expect, test } from "bun:test";
import { Err, Ok } from "@cprussin/option-result";
import type { DbusBody, DbusCall } from "@domicile-desktop/sdk/system";

import { holdAwake } from "./hold";

const settled = () => new Promise((resolve) => setTimeout(resolve, 5));

test("the inhibitor taken is the one let go", async () => {
  const calls: DbusCall[] = [];
  const letGo = holdAwake(
    {
      call: async (call) => {
        calls.push(call);
        return Ok({ signature: "o", body: ["/request/1"] } as unknown as DbusBody);
      },
    },
    "Casting",
  );
  await settled();
  expect(calls.map(({ member }) => member)).toEqual(["Inhibit"]);
  letGo();
  await settled();
  expect(calls.map(({ member, path }) => [member, path]).at(-1)).toEqual(["Close", "/request/1"]);
});

test("one that was refused is not let go", async () => {
  let calls = 0;
  const letGo = holdAwake(
    {
      call: async () => {
        calls += 1;
        return Err({ message: "no" } as never);
      },
    },
    "Casting",
  );
  letGo();
  await settled();
  expect(calls).toBe(1);
});
