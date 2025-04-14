import type { ContextValue, Contexts } from "./types";

export const contextLookup = (
  contexts: Contexts,
  propertyName: string | undefined
): ContextValue | undefined => {
  if (propertyName === undefined) {
    return undefined;
  }

  // Special case for "prefab.current-time" to always return the current timestamp
  if (propertyName === "prefab.current-time") {
    return +new Date();
  }

  let [name, key] = propertyName.split(".");

  if (key === undefined) {
    key = name;
    name = "";
  }

  if (key === undefined || name === undefined) {
    return undefined;
  }

  return contexts.get(name)?.get(key);
};
