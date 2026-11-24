/** What reads a sensor: `domicile.files`, or a test's stand-in. A failure reads as empty. */
export type Reader = {
  text: (path: string) => Promise<string>;
  names: (directory: string) => Promise<readonly string[]>;
};

/** The kernel drivers of a CPU's own sensor: AMD's, then Intel's. */
const DRIVERS = ["k10temp", "coretemp"];

const HWMON = "/sys/class/hwmon";

/** The CPU sensor's file. A driver's number changes between boots, so by name. */
export const findSensor = async ({ names, text }: Reader): Promise<string | undefined> => {
  for (const name of await names(HWMON)) {
    if (DRIVERS.includes((await text(`${HWMON}/${name}/name`)).trim())) {
      return `${HWMON}/${name}/temp1_input`;
    }
  }
  return undefined;
};

/** Whole degrees Celsius from the thousandths a sensor file holds. */
export const degrees = (text: string): number | undefined => {
  const thousandths = Number.parseInt(text, 10);
  return Number.isNaN(thousandths) ? undefined : Math.round(thousandths / 1000);
};
