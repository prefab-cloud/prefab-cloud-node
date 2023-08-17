import type Long from "long";
import type {
  ConditionalValue,
  Config,
  ConfigRow,
  ConfigValue,
  Criterion,
} from "./proto";
import { Criterion_CriterionOperator } from "./proto";
import type { Resolver } from "./resolver";
import type { Contexts, HashByPropertyValue, ProjectEnvId } from "./types";
import type { GetValue } from "./unwrap";
import { unwrap } from "./unwrap";
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

const propIsOneOf = (criterion: Criterion, contexts: Contexts): boolean => {
  return (criterion?.valueToMatch?.stringList?.values ?? []).some((value) => {
    return (
      contextLookup(contexts, criterion.propertyName)?.toString() ===
      value.toString()
    );
  });
};

const propEndsWithOneOf = (
  criterion: Criterion,
  contexts: Contexts
): boolean => {
  return (criterion.valueToMatch?.stringList?.values ?? []).some((value) => {
    return contextLookup(contexts, criterion.propertyName)
      ?.toString()
      .endsWith(value.toString());
  });
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
      case Criterion_CriterionOperator.IN_SEG:
        return inSegment(criterion, contexts, resolver);
      case Criterion_CriterionOperator.NOT_IN_SEG:
        return !inSegment(criterion, contexts, resolver);
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
  config: Config;
  projectEnvId: ProjectEnvId;
  namespace: string | undefined;
  contexts: Contexts;
  resolver: Resolver;
}

export interface Evaluation {
  configId: Long;
  configKey: string;
  configType: number;
  selectedValue?: ConfigValue;
  unwrappedValue: GetValue;
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

  const [unwrappedValue, weightedValueIndex] = unwrap(
    config.key,
    selectedValue,
    getHashByPropertyValue(selectedValue, contexts)
  );

  return {
    configKey: config.key,
    configId: config.id,
    configType: config.configType,
    selectedValue,
    conditionalValueIndex,
    configRowIndex,
    unwrappedValue,
    weightedValueIndex,
  };
};
