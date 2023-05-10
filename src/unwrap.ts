import type { ConfigValue, WeightedValue } from "./proto";
import type { HashByPropertyValue } from "./types";

import murmurhash from "murmurhash";

export type GetValue = string | number | boolean | string[] | undefined;

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
): GetValue => {
  const values = value.weightedValues?.weightedValues;

  if (values === undefined) {
    console.warn(`Unexpected value ${JSON.stringify(value)}`);
    return undefined;
  }

  const percent =
    hashByPropertyValue !== undefined
      ? userPercent(key, hashByPropertyValue)
      : Math.random();

  const index = variantIndex(percent, values);

  return unwrap(key, values[index]?.value, hashByPropertyValue);
};

export const unwrapValue = (
  key: string,
  value: ConfigValue,
  hashByPropertyValue: HashByPropertyValue
): GetValue => {
  switch (Object.keys(value)[0]) {
    case "string":
      return value.string;
    case "stringList":
      return value.stringList?.values;
    case "weightedValues":
      return unwrapWeightedValues(key, value, hashByPropertyValue);
    case "int":
      return value.int?.toInt();
    case "bool":
      return value.bool;
    default:
      throw new Error(`Unexpected value ${JSON.stringify(value)}`);
  }
};

export const unwrap = (
  key: string,
  value: ConfigValue | undefined,
  hashByPropertyValue: HashByPropertyValue
): GetValue => {
  if (value === undefined) {
    return undefined;
  }

  return unwrapValue(key, value, hashByPropertyValue);
};
