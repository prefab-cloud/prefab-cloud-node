import { createHash } from "crypto";
import {
  Config_ValueType,
  type ConfigValue,
  type Provided,
  ProvidedSource,
  type WeightedValue,
} from "./proto";
import type { HashByPropertyValue } from "./types";
import { isNonNullable } from "./types";
import type { MinimumConfig, Resolver } from "./resolver";
import { decrypt } from "./encryption";
import { durationToMilliseconds } from "./duration";

import murmurhash from "murmurhash";
import Long from "long";

const CONFIDENTIAL_PREFIX = "*****";

export const makeConfidential = (secret: string): string => {
  const md5 = createHash("md5").update(secret).digest("hex");

  return `${CONFIDENTIAL_PREFIX}${md5.slice(-5)}`;
};

export type GetValue =
  | string
  | number
  | boolean
  | string[]
  | object
  | undefined;

type WeightedValueIndex = number;

interface UnwrappedValue {
  value: GetValue;
  index?: WeightedValueIndex;
  reportableValue?: GetValue;
}

export const NULL_UNWRAPPED_VALUE: UnwrappedValue = {
  value: undefined,
  reportableValue: undefined,
};

const kindOf = (
  config: MinimumConfig | undefined,
  value: ConfigValue
): keyof ConfigValue | undefined => {
  const kind: keyof ConfigValue | undefined =
    configValueTypeToString(config?.valueType) ??
    (Object.keys(value)[0] as keyof ConfigValue);
  return kind;
};

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
): UnwrappedValue => {
  const values = value.weightedValues?.weightedValues;

  if (values === undefined) {
    console.warn(`Unexpected value ${JSON.stringify(value)}`);
    return NULL_UNWRAPPED_VALUE;
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

  return {
    value: underlyingValue.value,
    reportableValue: underlyingValue.reportableValue,
    index,
  };
};

const providedValue = (
  config: MinimumConfig,
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
      throw new Error(`Environment variable ${provided.lookup} not found`);
    }

    return coerceIntoType(config, envVar);
  }

  return undefined;
};

export const TRUE_VALUES = new Set(["true", "1", "t", "yes"]);

export const configValueTypeToString = (
  valueType: Config_ValueType | undefined
): keyof ConfigValue | undefined => {
  switch (valueType) {
    case Config_ValueType.STRING:
      return "string";
    case Config_ValueType.INT:
      return "int";
    case Config_ValueType.DOUBLE:
      return "double";
    case Config_ValueType.BOOL:
      return "bool";
    case Config_ValueType.STRING_LIST:
      return "stringList";
    case Config_ValueType.LOG_LEVEL:
      return "logLevel";
    case Config_ValueType.INT_RANGE:
      return "intRange";
    case Config_ValueType.DURATION:
      return "duration";
    case Config_ValueType.JSON:
      return "json";
    default:
      return undefined;
  }
};

const coerceIntoType = (config: MinimumConfig, value: string): GetValue => {
  switch (config.valueType) {
    case Config_ValueType.STRING:
      return value;
    case Config_ValueType.INT:
      if (!Number.isInteger(parseInt(value, 10))) {
        throw new Error(`Expected integer, got ${value}`);
      }
      return parseInt(value, 10);
    case Config_ValueType.DOUBLE:
      return parseFloat(value);
    case Config_ValueType.BOOL:
      return TRUE_VALUES.has(value.toLowerCase());
    case Config_ValueType.STRING_LIST:
      return value.split(/\s*,\s*/);
    case Config_ValueType.DURATION:
      return value;
    default:
      console.error(
        `Unexpected valueType ${config.valueType} for provided ${config.key}`
      );
      return undefined;
  }
};

export const unwrapValue = ({
  key,
  kind,
  value,
  hashByPropertyValue,
  primitivesOnly,
  config,
  resolver,
}: {
  key: string;
  kind: keyof ConfigValue;
  value: ConfigValue;
  hashByPropertyValue: HashByPropertyValue;
  primitivesOnly: boolean;
  config?: MinimumConfig;
  resolver?: Resolver;
}): Omit<UnwrappedValue, "reportableValue"> => {
  if (primitivesOnly) {
    if (isNonNullable(value.provided) || isNonNullable(value.decryptWith)) {
      console.error(
        `Unexpected value ${JSON.stringify(value)} in primitivesOnly mode`
      );
      return NULL_UNWRAPPED_VALUE;
    }
  } else {
    if (isNonNullable(value.decryptWith)) {
      if (resolver === undefined) {
        throw new Error("Resolver must be provided to unwrap encrypted values");
      }

      const key = resolver.get(value.decryptWith);

      if (key === undefined) {
        throw new Error(`Key ${value.decryptWith} not found`);
      }

      return {
        value: decrypt(value[kind] as string, key as string),
      };
    }

    if (value.provided != null) {
      if (config == null) {
        throw new Error(
          `Unexpected value ${JSON.stringify(
            value
          )} in provided mode without config`
        );
      }

      return { value: providedValue(config, value.provided) };
    }
  }

  if (value.weightedValues != null) {
    return unwrapWeightedValues(key, value, hashByPropertyValue);
  }

  switch (kind) {
    case "string":
      return { value: value.string };
    case "stringList":
      return { value: value.stringList?.values };
    case "int":
      if (Number.isInteger(value.int)) {
        const val = value.int as unknown as number;
        return { value: val };
      }
      if (Long.isLong(value.int)) {
        if (longIsIntSafe(value.int)) {
          return { value: value.int.toInt() };
        }
        return { value: value.int };
      }
      return { value: undefined };
    case "bool":
      return { value: value.bool };
    case "double":
      return { value: value.double };
    case "logLevel":
      return { value: value.logLevel };
    case "json":
      if (value.json?.json === undefined) {
        throw new Error(`Invalid json value for ${key}`);
      }

      return { value: JSON.parse(value.json.json) };
    case "duration":
      if (value.duration?.definition === undefined) {
        throw new Error(`No duration definition found for ${key}`);
      }

      return {
        value: durationToMilliseconds(value.duration.definition),
      };
    default:
      throw new Error(
        `Unexpected value ${JSON.stringify(value)} | kind=${JSON.stringify(
          kind
        )}`
      );
  }
};

export const unwrap = ({
  key,
  value,
  hashByPropertyValue,
  primitivesOnly = false,
  config,
  resolver,
}: {
  key: string;
  value: ConfigValue | undefined;
  hashByPropertyValue?: HashByPropertyValue;
  primitivesOnly?: boolean;
  config?: MinimumConfig;
  resolver?: Resolver;
}): UnwrappedValue => {
  if (value === undefined) {
    return NULL_UNWRAPPED_VALUE;
  }

  const kind = kindOf(config, value);

  if (kind === undefined) {
    throw new Error(`Unexpected value ${JSON.stringify(value)}`);
  }

  const unwrappedValue = unwrapValue({
    kind,
    key,
    value,
    hashByPropertyValue,
    primitivesOnly,
    config,
    resolver,
  });

  const shouldObscure: boolean =
    value.confidential === true || isNonNullable(value.decryptWith);

  return {
    ...unwrappedValue,
    reportableValue: shouldObscure
      ? makeConfidential((value[kind] as string).toString())
      : undefined,
  };
};

export const unwrapPrimitive = (
  key: string,
  value: ConfigValue | undefined
): UnwrappedValue => {
  return unwrap({ key, value, primitivesOnly: true });
};

export const longIsIntSafe = (longValue: Long): boolean => {
  return longValue.high === 0 || longValue.high === -1;
};
