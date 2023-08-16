import type { ConfigValue } from "./proto";

type ConfigValueKey = keyof ConfigValue;

export const valueType = (value: unknown): ConfigValueKey => {
  if (Number.isInteger(value)) {
    return "int";
  }

  if (typeof value === "number") {
    return "double";
  }

  if (typeof value === "boolean") {
    return "bool";
  }

  if (Array.isArray(value)) {
    return "stringList";
  }

  return "string";
};

export const wrap = (value: unknown): Record<string, ConfigValue> => {
  return {
    [valueType(value)]: value as ConfigValue,
  };
};
