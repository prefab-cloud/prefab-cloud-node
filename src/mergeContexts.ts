import type { Contexts } from "./types";

export const mergeContexts = (
  parent: Contexts | undefined,
  local: Contexts
): Contexts => {
  if (parent === undefined) {
    return local;
  }

  const merged = new Map(parent);
  for (const [key, value] of local) {
    merged.set(key, value);
  }

  return merged;
};
