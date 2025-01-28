import Long from "long";
import type { SyncResult, Telemetry } from "./types";
import type { ApiClient } from "../apiClient";
import type { Evaluation } from "../evaluate";
import type {
  ConfigEvaluationCounter,
  ConfigEvaluationSummary,
  TelemetryEvent,
  TelemetryEvents,
} from "../proto";
import { ConfigType } from "../proto";
import { encode } from "../parseProto";
import { now } from "./reporter";
import { valueType } from "../wrap";
import { configValueTypeToString } from "../unwrap";

const ENDPOINT = "/api/v1/telemetry";

type CounterKey = string;
type Counter = Map<string, number>;

type EvaluationSummariesTelemetry = Telemetry & {
  push: (evaluation: Evaluation) => void;
  data: Map<CounterKey, Counter>;
};

export const stub: EvaluationSummariesTelemetry = {
  enabled: false,
  sync: async () => undefined,
  timeout: undefined,
  data: new Map(),
  push: () => {},
};

export const evaluationSummaries = (
  apiClient: ApiClient,
  telemetryHost: string | undefined,
  instanceHash: string,
  collectEvaluationSummaries: boolean,
  maxDataSize: number = 10000
): EvaluationSummariesTelemetry => {
  if (!collectEvaluationSummaries) {
    return stub;
  }

  let startAt: Long | undefined;
  const data: EvaluationSummariesTelemetry["data"] = new Map();

  const incrementCounter = (key: string, counter: string): void => {
    const countersForKey = data.get(key);

    let newCount = 0;

    if (countersForKey !== undefined) {
      newCount = countersForKey.get(counter) ?? 0;
    }

    data.set(
      key,
      new Map([...(countersForKey ?? []), [counter, newCount + 1]])
    );
  };

  return {
    enabled: true,

    data,

    timeout: undefined,

    push(evaluation: Evaluation): void {
      if (telemetryHost === undefined) {
        return;
      }

      if (evaluation.configId === undefined) {
        return;
      }

      if (data.size >= maxDataSize) {
        return;
      }

      startAt = startAt ?? now();

      if (
        evaluation.unwrappedValue === undefined ||
        evaluation.configType === ConfigType.LOG_LEVEL
      ) {
        return;
      }

      const key = JSON.stringify([
        evaluation.configKey,
        evaluation.configType.toString(),
      ]);

      const valueTypeAsString =
        configValueTypeToString(evaluation.valueType) ??
        valueType(evaluation.unwrappedValue);

      const counter = JSON.stringify([
        evaluation.configId.toString(),
        evaluation.conditionalValueIndex,
        evaluation.configRowIndex,
        valueTypeAsString,
        evaluation.reportableValue ?? evaluation.unwrappedValue,
        evaluation.weightedValueIndex,
      ]);

      incrementCounter(key, counter);
    },

    sync: async (): Promise<SyncResult | undefined> => {
      if (data.size === 0 || telemetryHost === undefined) {
        return undefined;
      }

      const summaries: ConfigEvaluationSummary[] = [];

      data.forEach((rawCounters, keyJSON) => {
        const [key, type] = JSON.parse(keyJSON);

        const counters: ConfigEvaluationCounter[] = [];

        rawCounters.forEach((count, counterJSON) => {
          const [
            configId,
            conditionalValueIndex,
            configRowIndex,
            valueType,
            unwrappedValue,
            weightedValueIndex,
          ] = JSON.parse(counterJSON);

          let selectedValue;

          if (valueType === "json") {
            selectedValue = { json: { json: JSON.stringify(unwrappedValue) } };
          } else if (valueType === "stringList") {
            selectedValue = { stringList: { values: unwrappedValue } };
          } else {
            selectedValue = { [valueType]: unwrappedValue };
          }

          const counter: ConfigEvaluationCounter = {
            configId: Long.fromNumber(configId),
            conditionalValueIndex,
            configRowIndex,
            selectedValue,
            count: Long.fromNumber(count),
            reason: 0,
          };

          if (weightedValueIndex !== null) {
            counter.weightedValueIndex = weightedValueIndex;
          }

          counters.push(counter);
        });

        const summary: ConfigEvaluationSummary = {
          key,
          type,
          counters,
        };

        summaries.push(summary);

        data.delete(keyJSON);
      });

      const event: TelemetryEvent = {
        summaries: {
          start: startAt ?? Long.fromNumber(Date.now()),
          end: now(),
          summaries,
        },
      };

      const apiData: TelemetryEvents = {
        instanceHash,
        events: [event],
      };

      const body = encode("TelemetryEvents", apiData);

      const result = await apiClient.fetch({
        source: telemetryHost,
        path: ENDPOINT,
        options: {
          method: "POST",
          body,
        },
      });

      return {
        status: result.status,
        dataSent: apiData,
      };
    },
  };
};
