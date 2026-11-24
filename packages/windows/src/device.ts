import type { Ask } from "./ask";

type Device = Pick<DomicileDeviceRequestEvent, "cancel" | "choose" | "devices" | "listed" | "title">;

/** A page's request for a HID, USB or serial device. Nothing is chosen at first, as in Chrome. */
export const deviceAsk = (event: Device): Ask => {
  const devices = event.devices();
  const message =
    devices.length > 0
      ? undefined
      : event.listed
        ? "No device found. Plug it in or turn it on, and it shows up here."
        : "Looking for devices…";
  return {
    title: event.title,
    ...(message === undefined ? {} : { message }),
    choices: devices.map(({ id, name }) => ({ value: id, label: name })),
    grants: true,
    yes: "Connect",
    no: "Cancel",
    accept: ({ choice }) => event.choose([choice]),
    dismiss: () => event.cancel(),
  };
};
