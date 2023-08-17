import type { ConfigValue, StringList } from "./proto";

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
  const type = valueType(value);

  if (Array.isArray(value)) {
    if (type !== "stringList") {
      throw new Error(`Expected stringList, got ${type}`);
    }

    const values: string[] = value.map((v) => v.toString());
    const stringList: StringList = { values };

    return {
      stringList: stringList as ConfigValue,
    };
  }

  return {
    [valueType(value)]: value as ConfigValue,
  };
};
