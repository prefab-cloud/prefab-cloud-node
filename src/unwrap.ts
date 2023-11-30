import type { Config, ConfigValue, Provided, WeightedValue } from "./proto";
import { Config_ValueType, ProvidedSource } from "./proto";
import type { HashByPropertyValue } from "./types";

import murmurhash from "murmurhash";

export type GetValue = string | number | boolean | string[] | undefined;

type WeightedValueIndex = number;

type GetValueWithWeightedValueIndex = [
  GetValue,
  WeightedValueIndex | undefined
];

const userPercent = (key: string, hashByPropertyValue: string): number => {
  return murmurhash.v3(`${key}${hashByPropertyValue}`) / 4_294_967_294.0;
};

const variantIndex = (
  percentThroughDistribution: number,
  weights: WeightedValue[]
): number => {
  const distributionSpace = weights.reduce((sum, v) => sum + v.weight, 0);
  const bucket = distributionSpace * percentThroughDistribution;

  let sum = 0;
  for (const [index, variantWeight] of weights.entries()) {
    if (bucket < sum + variantWeight.weight) {
      return index;
    }

    sum += variantWeight.weight;
  }

  // In the event that all weights are zero, return the last variant
  return weights.length - 1;
};

const unwrapWeightedValues = (
  key: string,
  value: ConfigValue,
  hashByPropertyValue: HashByPropertyValue
): GetValueWithWeightedValueIndex => {
  const values = value.weightedValues?.weightedValues;

  if (values === undefined) {
    console.warn(`Unexpected value ${JSON.stringify(value)}`);
    return [undefined, undefined];
  }

  const percent =
    hashByPropertyValue !== undefined
      ? userPercent(key, hashByPropertyValue)
      : Math.random();

  const index = variantIndex(percent, values);

  const underlyingValue = unwrap({
    key,
    value: values[index]?.value,
    hashByPropertyValue,
  });

  return [
    Array.isArray(underlyingValue) ? underlyingValue[0] : underlyingValue,
    index,
  ];
};

const providedValue = (
  config: Config,
  provided: Provided | undefined
): GetValue => {
  if (provided == null) {
    return undefined;
  }

  if (
    provided.source === ProvidedSource.ENV_VAR &&
    provided.lookup !== undefined
  ) {
    const envVar = process.env[provided.lookup];

    if (envVar === undefined) {
      console.error(
        `ENV Variable ${provided.lookup} not found. Using empty string.`
      );
      return "";
    }

    return coerceIntoType(config, envVar);
  }

  return undefined;
};

export const TRUE_VALUES = new Set(["true", "1", "t", "yes"]);

const coerceIntoType = (config: Config, value: string): GetValue => {
  switch (config.valueType) {
    case Config_ValueType.STRING:
      return value;
    case Config_ValueType.INT:
      return parseInt(value);
    case Config_ValueType.DOUBLE:
      return parseFloat(value);
    case Config_ValueType.BOOL:
      return TRUE_VALUES.has(value.toLowerCase());
    case Config_ValueType.STRING_LIST:
      return value.split(/\s*,\s*/);
    default:
      console.error(
        `Unexpected valueType ${config.valueType} for provided ${config.key}`
      );
      return undefined;
  }
};

export const unwrapValue = ({
  key,
  value,
  hashByPropertyValue,
  primitivesOnly,
  config,
}: {
  key: string;
  value: ConfigValue;
  hashByPropertyValue: HashByPropertyValue;
  primitivesOnly: boolean;
  config?: Config;
}): GetValueWithWeightedValueIndex => {
  const kind = Object.keys(value)[0];

  switch (kind) {
    case "string":
      return [value.string, undefined];
    case "stringList":
      return [value.stringList?.values, undefined];
    case "int":
      return [value.int?.toInt(), undefined];
    case "bool":
      return [value.bool, undefined];
    case "double":
      return [value.double, undefined];
    case "logLevel":
      return [value.logLevel, undefined];
    case "weightedValues":
      return unwrapWeightedValues(key, value, hashByPropertyValue);
  }

  if (primitivesOnly) {
    console.error(
      `Unexpected value ${JSON.stringify(value)} in primitivesOnly mode`
    );
    return [undefined, undefined];
  } else {
    switch (kind) {
      case "provided":
        if (config == null) {
          throw new Error(
            `Unexpected value ${JSON.stringify(
              value
            )} in provided mode without config`
          );
        }
        return [providedValue(config, value.provided), undefined];
      default:
        throw new Error(`Unexpected value ${JSON.stringify(value)}`);
    }
  }
};

export const unwrap = ({
  key,
  value,
  hashByPropertyValue,
  primitivesOnly = false,
  config,
}: {
  key: string;
  value: ConfigValue | undefined;
  hashByPropertyValue?: HashByPropertyValue;
  primitivesOnly?: boolean;
  config?: Config;
}): GetValueWithWeightedValueIndex => {
  if (value === undefined) {
    return [undefined, undefined];
  }

  return unwrapValue({
    key,
    value,
    hashByPropertyValue,
    primitivesOnly,
    config,
  });
};

export const unwrapPrimitive = (
  key: string,
  value: ConfigValue | undefined
): GetValueWithWeightedValueIndex => {
  return unwrap({ key, value, primitivesOnly: true });
};
