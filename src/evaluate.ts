import Long from "long";
import {
  type ConditionalValue,
  type ConfigRow,
  type ConfigValue,
  type Criterion,
  Criterion_CriterionOperator,
} from "./proto";
import type { MinimumConfig, Resolver } from "./resolver";
import type { Contexts, HashByPropertyValue, ProjectEnvId } from "./types";
import { type GetValue, unwrap } from "./unwrap";
import { contextLookup } from "./contextLookup";
import { sortRows } from "./sortRows";

const getHashByPropertyValue = (
  value: ConfigValue | undefined,
  contexts: Contexts
): HashByPropertyValue => {
  if (value?.weightedValues === undefined || value?.weightedValues === null) {
    return undefined;
  }

  return contextLookup(
    contexts,
    value.weightedValues.hashByPropertyName
  )?.toString();
};

const getArrayifiedContextValue = (
  contexts: any,
  criterion: { propertyName: string }
): string[] => {
  const result = contextLookup(contexts, criterion.propertyName);

  if (Array.isArray(result)) {
    return result.map((item) => item.toString());
  } else {
    return [result?.toString() ?? ""];
  }
};

const propIsOneOf = (criterion: Criterion, contexts: Contexts): boolean => {
  const contextValue: string[] = getArrayifiedContextValue(contexts, criterion);

  return (criterion?.valueToMatch?.stringList?.values ?? []).some((value) => {
    return contextValue.includes(value.toString());
  });
};

const propMatchesOneOf = (
  criterion: Criterion,
  contexts: Contexts,
  matcher: (contextValue: string, value: string) => boolean
): boolean => {
  return (criterion.valueToMatch?.stringList?.values ?? []).some((value) => {
    const contextValue = contextLookup(
      contexts,
      criterion.propertyName
    )?.toString();
    // Explicitly check for non-null and non-empty contextValue
    return (
      contextValue != null &&
      contextValue !== "" &&
      matcher(contextValue, value.toString())
    );
  });
};

const propEndsWithOneOf = (
  criterion: Criterion,
  contexts: Contexts
): boolean => {
  return propMatchesOneOf(criterion, contexts, (contextValue, value) =>
    contextValue.endsWith(value)
  );
};

const propStartsWithOneOf = (
  criterion: Criterion,
  contexts: Contexts
): boolean => {
  return propMatchesOneOf(criterion, contexts, (contextValue, value) =>
    contextValue.startsWith(value)
  );
};

const propContainsOneOf = (
  criterion: Criterion,
  contexts: Contexts
): boolean => {
  return propMatchesOneOf(criterion, contexts, (contextValue, value) =>
    contextValue.includes(value)
  );
};

const inSegment = (
  criterion: Criterion,
  contexts: Contexts,
  resolver: Resolver
): boolean => {
  const segmentKey = criterion.valueToMatch?.string;

  if (segmentKey === undefined) {
    return false;
  }

  if (resolver.raw(segmentKey) === undefined) {
    console.warn(`Segment ${segmentKey} not found`);
    return false;
  }

  const segment = resolver.get(segmentKey, contexts);

  if (typeof segment !== "boolean") {
    console.warn(
      `Segment ${segmentKey} is of unexpected type ${typeof segment}`
    );
    return false;
  }

  return segment;
};

const inIntRange = (criterion: Criterion, contexts: Contexts): boolean => {
  const contextsWithCurrentTime = new Map(contexts);
  const prefabContext = contextsWithCurrentTime.get("prefab") ?? new Map();
  prefabContext.set("current-time", +new Date());
  contextsWithCurrentTime.set("prefab", prefabContext);

  const start = criterion.valueToMatch?.intRange?.start;
  const end = criterion.valueToMatch?.intRange?.end;

  const comparable = contextLookup(
    contextsWithCurrentTime,
    criterion.propertyName
  );

  if (start === undefined || end === undefined || comparable === undefined) {
    return false;
  }

  return start.lte(comparable as number) && end.gte(comparable as number);
};

const dateValueToLong = (
  value: number | Long | string | unknown
): Long | undefined => {
  if (Long.isLong(value)) {
    return value;
  } else if (typeof value === "number") {
    return Long.fromNumber(value); // Already in millis
  } else if (typeof value === "string") {
    const parsedDate = Date.parse(value); // Convert to millis
    if (isNaN(parsedDate)) {
      return undefined;
    }
    return Long.fromNumber(parsedDate);
  }
  return undefined;
};

const evaluateNumericCriterion = (
  criterion: Criterion,
  contexts: Contexts,
  comparisonFn: (compareResult: number) => boolean
): boolean => {
  const contextValue = normalizeNumber(
    contextLookup(contexts, criterion.propertyName)
  );
  const configValue = normalizeNumber(
    unwrap({ key: "ignored", value: criterion.valueToMatch }).value
  );

  if (configValue == null || contextValue == null) {
    return false;
  }
  const compareToResult = compareTo(contextValue, configValue);
  return comparisonFn(compareToResult);
};

function normalizeNumber(value: unknown): Long | number | null {
  if (Long.isLong(value)) return value;
  if (typeof value === "number") return value;
  return null; // Invalid type
}

function compareTo(left: number | Long, right: number | Long): number {
  const leftNum = Long.isLong(left) ? left.toNumber() : left;
  const rightNum = Long.isLong(right) ? right.toNumber() : right;

  // If either value is a float, use direct number comparison
  if (!Number.isInteger(leftNum) || !Number.isInteger(rightNum)) {
    if (leftNum < rightNum) {
      return -1;
    } else if (leftNum > rightNum) {
      return 1;
    } else {
      return 0;
    }
  }

  // Both are integers, safe to compare as Longs
  if (Long.isLong(left) || Long.isLong(right)) {
    return Long.fromNumber(leftNum).compare(Long.fromNumber(rightNum));
  }

  if (leftNum < rightNum) {
    return -1;
  } else if (leftNum > rightNum) {
    return 1;
  } else {
    return 0;
  }
}

const evaluateDateCriterion = (
  criterion: Criterion,
  contexts: Contexts,
  comparator: (a: Long, b: Long) => boolean
): boolean => {
  // Retrieve the context value (which might be a timestamp in millis or an HTTP date string)
  const contextMillis = dateValueToLong(
    contextLookup(contexts, criterion.propertyName)
  );
  const configMills = dateValueToLong(
    unwrap({ key: "why", value: criterion.valueToMatch }).value
  );
  if (
    typeof configMills === "undefined" ||
    typeof contextMillis === "undefined"
  ) {
    return false;
  }
  return comparator(contextMillis, configMills);
};

const allCriteriaMatch = (
  value: ConditionalValue,
  namespace: string | undefined,
  contexts: Contexts,
  resolver: Resolver
): boolean => {
  if (value.criteria === undefined) {
    return true;
  }

  return value.criteria.every((criterion) => {
    switch (criterion.operator) {
      case Criterion_CriterionOperator.HIERARCHICAL_MATCH:
        return criterion.valueToMatch?.string === namespace;
      case Criterion_CriterionOperator.PROP_IS_ONE_OF:
        return propIsOneOf(criterion, contexts);
      case Criterion_CriterionOperator.PROP_IS_NOT_ONE_OF:
        return !propIsOneOf(criterion, contexts);
      case Criterion_CriterionOperator.PROP_ENDS_WITH_ONE_OF:
        return propEndsWithOneOf(criterion, contexts);
      case Criterion_CriterionOperator.PROP_DOES_NOT_END_WITH_ONE_OF:
        return !propEndsWithOneOf(criterion, contexts);
      case Criterion_CriterionOperator.PROP_STARTS_WITH_ONE_OF:
        return propStartsWithOneOf(criterion, contexts);
      case Criterion_CriterionOperator.PROP_DOES_NOT_START_WITH_ONE_OF:
        return !propStartsWithOneOf(criterion, contexts);
      case Criterion_CriterionOperator.PROP_CONTAINS_ONE_OF:
        return propContainsOneOf(criterion, contexts);
      case Criterion_CriterionOperator.PROP_DOES_NOT_CONTAIN_ONE_OF:
        return !propContainsOneOf(criterion, contexts);
      case Criterion_CriterionOperator.IN_SEG:
        return inSegment(criterion, contexts, resolver);
      case Criterion_CriterionOperator.NOT_IN_SEG:
        return !inSegment(criterion, contexts, resolver);
      case Criterion_CriterionOperator.IN_INT_RANGE:
        return inIntRange(criterion, contexts);
      case Criterion_CriterionOperator.PROP_BEFORE:
        return evaluateDateCriterion(criterion, contexts, (a, b) => a.lt(b));
      case Criterion_CriterionOperator.PROP_AFTER:
        return evaluateDateCriterion(criterion, contexts, (a, b) => a.gt(b));
      case Criterion_CriterionOperator.PROP_GREATER_THAN:
        return evaluateNumericCriterion(
          criterion,
          contexts,
          (compareResult) => compareResult > 0
        );
      case Criterion_CriterionOperator.PROP_GREATER_THAN_OR_EQUAL:
        return evaluateNumericCriterion(
          criterion,
          contexts,
          (compareResult) => compareResult >= 0
        );
      case Criterion_CriterionOperator.PROP_LESS_THAN:
        return evaluateNumericCriterion(
          criterion,
          contexts,
          (compareResult) => compareResult < 0
        );
      case Criterion_CriterionOperator.PROP_LESS_THAN_OR_EQUAL:
        return evaluateNumericCriterion(
          criterion,
          contexts,
          (compareResult) => compareResult <= 0
        );
      default:
        throw new Error(
          `Unexpected criteria ${JSON.stringify(criterion.operator)}`
        );
    }
  });
};

const matchingConfigValue = (
  rows: ConfigRow[],
  projectEnvId: ProjectEnvId,
  namespace: string | undefined,
  contexts: Contexts,
  resolver: Resolver
): [number, number, ConfigValue | undefined] => {
  let match: ConfigValue | undefined;
  let conditionalValueIndex: number = -1;
  let configRowIndex: number = -1;

  sortRows(rows, projectEnvId).forEach((row, rIndex) => {
    if (match !== undefined) {
      return;
    }

    if (rows.values === undefined) {
      return;
    }

    match = row.values.find((value: any, vIndex) => {
      conditionalValueIndex = vIndex;
      return allCriteriaMatch(value, namespace, contexts, resolver);
    })?.value;

    if (match !== undefined) {
      configRowIndex = rIndex;
    }
  });

  return [conditionalValueIndex, configRowIndex, match];
};

export interface EvaluateArgs {
  config: MinimumConfig;
  projectEnvId: ProjectEnvId;
  namespace: string | undefined;
  contexts: Contexts;
  resolver: Resolver;
}

export interface Evaluation {
  configId: Long | undefined;
  configKey: string;
  configType: number;
  valueType: number;
  unwrappedValue: GetValue;
  reportableValue: GetValue;
  conditionalValueIndex: number;
  configRowIndex: number;
  weightedValueIndex?: number;
}

export const evaluate = ({
  config,
  projectEnvId,
  namespace,
  contexts,
  resolver,
}: EvaluateArgs): Evaluation => {
  const [conditionalValueIndex, configRowIndex, selectedValue] =
    matchingConfigValue(
      config.rows,
      projectEnvId,
      namespace,
      contexts ?? new Map(),
      resolver
    );

  const {
    value: unwrappedValue,
    reportableValue,
    index: weightedValueIndex,
  } = unwrap({
    key: config.key,
    config,
    value: selectedValue,
    hashByPropertyValue: getHashByPropertyValue(selectedValue, contexts),
    resolver,
  });

  return {
    configKey: config.key,
    configId: config.id,
    configType: config.configType,
    valueType: config.valueType,
    conditionalValueIndex,
    configRowIndex,
    unwrappedValue,
    weightedValueIndex,
    reportableValue,
  };
};
