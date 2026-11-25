/** Chrome's page zoom steps. */
const STEPS = [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

// A page's factor goes through a logarithm and is not exact.
const NEAR = 0.001;

/** The step above `factor`, or the largest. */
export const zoomedIn = (factor: number): number => STEPS.find((step) => step > factor + NEAR) ?? 5;

/** The step below `factor`, or the smallest. */
export const zoomedOut = (factor: number): number => STEPS.findLast((step) => step < factor - NEAR) ?? 0.25;
