import Long from "long";
import {type ConditionalValue, type ConfigRow, type ConfigValue, type Criterion, Criterion_CriterionOperator,} from "./proto";
import type {MinimumConfig, Resolver} from "./resolver";
import type {Contexts, HashByPropertyValue, ProjectEnvId} from "./types";
import {type GetValue, unwrap} from "./unwrap";
import {contextLookup} from "./contextLookup";
import {sortRows} from "./sortRows";

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

const evaluateDateCriterion = (criterion: Criterion, contexts: Contexts): boolean => {
  // Retrieve the context value (which might be a timestamp in millis or an HTTP date string)
  const contextValue = contextLookup(contexts, criterion.propertyName);
  let contextMillis: Long;

  if (Long.isLong(contextValue)) {
    contextMillis = contextValue;
  } else if (typeof contextValue === "number") {
    contextMillis = Long.fromNumber(contextValue); // Already in millis
  } else if (typeof contextValue === "string") {
    const parsedDate = Date.parse(contextValue);  // Convert to millis
    if (isNaN(parsedDate)) {
      return false;
    }
    contextMillis = Long.fromNumber(parsedDate);
  } else {
    return false;
  }

  const valueToMatch = makeLong(unwrap({key: "why", value: criterion.valueToMatch}).value)
  if (!Long.isLong(valueToMatch)) {
    return false;
  }

  switch (criterion.operator) {
    case Criterion_CriterionOperator.PROP_BEFORE:
      return contextMillis.lt(valueToMatch);
    case Criterion_CriterionOperator.PROP_AFTER:
      return contextMillis.gt(valueToMatch);
  }
  return false;
};

const makeLong = (value: unknown): Long | undefined => {
  if (Long.isLong(value)) {
    return value;
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return Long.fromNumber(value);
  }
  return undefined; // Return undefined for non-numeric or non-Long values
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
      case Criterion_CriterionOperator.PROP_AFTER:
        // fall through
      case Criterion_CriterionOperator.PROP_BEFORE:
        return evaluateDateCriterion(criterion, contexts);
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
