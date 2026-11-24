import {
  type Devices,
  PortalAnswer,
  PortalKind,
  type PortalRequest,
  WallpaperTarget,
} from "@domicile-desktop/sdk/portal";

/** A request answered yes or no. */
export type Question = {
  title: string;
  lines: readonly string[];
  /** A path to a picture to show. */
  picture: string | undefined;
  accept: string;
  deny: string;
  /** Red: it gives something away or cannot be undone. */
  danger: boolean;
  yes: PortalAnswer;
};

const devices = (asked: Devices): string =>
  (["keyboard", "pointer", "touchscreen"] as const).filter((device) => asked[device]).join(", ") || "no devices";

const target = (setOn: WallpaperTarget): string => {
  switch (setOn) {
    case WallpaperTarget.Background:
      return "the desktop";
    case WallpaperTarget.Lockscreen:
      return "the lock screen";
    case WallpaperTarget.Both:
      return "the desktop and the lock screen";
  }
};

/** `request` as a yes or no question, or `undefined` when it asks for more. */
export const questionOf = (request: PortalRequest): Question | undefined => {
  const asker = request.appId || "An application";
  const question = (title: string, yes: PortalAnswer, rest: Partial<Question> = {}): Question => ({
    title,
    lines: [],
    picture: undefined,
    accept: "Allow",
    deny: "Cancel",
    danger: false,
    yes,
    ...rest,
  });
  switch (request.kind) {
    case PortalKind.Access: {
      const { title, subtitle, body, grantLabel, denyLabel, destructive } = request.body;
      return question(title, PortalAnswer.Access(), {
        lines: [subtitle, body].filter((line) => line !== ""),
        accept: grantLabel ?? "Allow",
        deny: denyLabel ?? "Deny",
        danger: destructive,
      });
    }
    case PortalKind.Account: {
      const { name, image, reason } = request.body;
      return question(`${asker} asks for your name and picture`, PortalAnswer.Access(), {
        lines: [name, ...(reason === undefined ? [] : [reason])],
        picture: image,
      });
    }
    case PortalKind.RemoteDesktop: {
      const { devices: asked, clipboard } = request.body;
      return question(`${asker} asks to control your desktop`, PortalAnswer.RemoteDesktop(asked, clipboard), {
        lines: [`Input: ${devices(asked)}`, ...(clipboard ? ["Your clipboard too"] : [])],
        danger: true,
      });
    }
    case PortalKind.InputCapture:
      return question(`${asker} asks to take your input at a screen edge`, PortalAnswer.InputCapture(), {
        lines: [`Input: ${devices(request.body.devices)}`],
        danger: true,
      });
    case PortalKind.Usb:
      return question(`${asker} asks to open USB devices`, PortalAnswer.Access(), {
        lines: request.body.devices.map(
          ({ product, vendor, id, writable }) =>
            `${[vendor, product].filter(Boolean).join(" ") || id}${writable ? "" : " (read only)"}`,
        ),
        danger: true,
      });
    case PortalKind.Wallpaper:
      return question(`${asker} asks to set a wallpaper`, PortalAnswer.Access(), {
        lines: [`On ${target(request.body.setOn)}`],
        picture: request.body.path,
        accept: "Set",
      });
    default:
      return undefined;
  }
};
