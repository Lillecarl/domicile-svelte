import type { Result } from "@cprussin/option-result";
import type { Dbus } from "@domicile-desktop/sdk/desktop/dbus";
import { Bus, type SystemError } from "@domicile-desktop/sdk/system";

/** The Inhibit portal's flag for the idle timer. */
const IDLE = 8;
const PORTAL = { bus: Bus.Session, destination: "org.freedesktop.portal.Desktop" };

const inhibit = async (dbus: Pick<Dbus, "call">, reason: string): Promise<Result<string, SystemError>> =>
  (
    await dbus.call({
      ...PORTAL,
      path: "/org/freedesktop/portal/desktop",
      interface: "org.freedesktop.portal.Inhibit",
      member: "Inhibit",
      signature: "sua{sv}",
      body: ["", IDLE, { reason: { signature: "s", value: reason } }],
    })
  ).map(({ body }) => String(Array.isArray(body) ? body[0] : body));

/** Holds off idle blanking until the function it returns is called. */
export const holdAwake = (dbus: Pick<Dbus, "call">, reason: string): (() => void) => {
  const failed = (error: unknown) => console.error("could not hold off idle blanking", error);
  const held = inhibit(dbus, reason);
  held.then((result) => result.match({ Err: failed, Ok: () => undefined })).catch(failed);
  return () => {
    held
      .then((result) =>
        result.match<Promise<unknown>>({
          // Never held, so there is nothing to let go.
          Err: () => Promise.resolve(),
          Ok: (path) => dbus.call({ ...PORTAL, path, interface: "org.freedesktop.portal.Request", member: "Close" }),
        }),
      )
      .catch(failed);
  };
};
