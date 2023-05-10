import Long from "long";

export const nTimes = (n: number, fn: () => void): void => {
  for (let i = 0; i < n; i++) {
    fn();
  }
};

export const projectEnvIdUnderTest = new Long(5);
export const emptyContexts = new Map();
export const irrelevant = "this value does not matter";
export const irrelevantLong = new Long(-1);
