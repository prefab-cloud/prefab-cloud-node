import type { ConfigValue, StringList } from "./proto";
import { Config_ValueType } from "./proto";

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

export const configValueType = (
  value: ConfigValue
): Config_ValueType | undefined => {
  switch (Object.keys(value)[0]) {
    case "string":
      return Config_ValueType.STRING;
    case "int":
      return Config_ValueType.INT;
    case "double":
      return Config_ValueType.DOUBLE;
    case "bool":
      return Config_ValueType.BOOL;
    case "stringList":
      return Config_ValueType.STRING_LIST;
    case "logLevel":
      return Config_ValueType.LOG_LEVEL;
    case "intRange":
      return Config_ValueType.INT_RANGE;
    case "json":
      return Config_ValueType.JSON;
    default:
      return undefined;
  }
};
