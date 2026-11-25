import { type Download, DownloadState } from "@domicile-desktop/sdk/desktop/downloads";

type Sized = Pick<Download, "receivedBytes" | "totalBytes">;

const UNITS = ["B", "kB", "MB", "GB", "TB"];
const powerOf = (bytes: number): number =>
  bytes < 1000 ? 0 : Math.min(UNITS.length - 1, Math.floor(Math.log10(bytes) / 3));
const amount = (bytes: number, power: number): string => String(Number((bytes / 1000 ** power).toFixed(1)));

export const size = (bytes: number): string => `${amount(bytes, powerOf(bytes))} ${UNITS[powerOf(bytes)]}`;

/** What came in, in the total's unit. A total of 0 is unknown. */
export const progress = ({ receivedBytes, totalBytes }: Sized): string =>
  totalBytes === 0
    ? `${size(receivedBytes)} so far`
    : `${amount(receivedBytes, powerOf(totalBytes))} of ${size(totalBytes)}`;

/** How far `downloads` are together, 0 to 1; undefined while a size is unknown. */
export const fraction = (downloads: readonly Sized[]): number | undefined => {
  const total = downloads.reduce((sum, { totalBytes }) => sum + totalBytes, 0);
  const received = downloads.reduce((sum, { receivedBytes }) => sum + receivedBytes, 0);
  return total === 0 || downloads.some(({ totalBytes }) => totalBytes === 0)
    ? undefined
    : Math.min(1, received / total);
};

export const fileName = (path: string): string => path.slice(path.lastIndexOf("/") + 1);
export const folder = (path: string): string => path.slice(0, path.lastIndexOf("/")) || "/";

/** The site a download came from; undefined for a page without one. */
export const site = (page: string): string | undefined => {
  const host = URL.canParse(page) ? new URL(page).hostname : "";
  return host === "" ? undefined : host;
};

/** The second line of a row. */
export const detail = (download: Pick<Download, "page" | "receivedBytes" | "state" | "totalBytes">): string =>
  [
    {
      [DownloadState.InProgress]: progress(download),
      [DownloadState.Complete]: size(download.receivedBytes),
      [DownloadState.Failed]: "Failed",
    }[download.state],
    site(download.page),
  ]
    .filter((part) => part !== undefined)
    .join(" · ");
