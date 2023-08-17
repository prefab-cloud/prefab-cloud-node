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
  instanceHash: string,
  collectEvaluationSummaries: boolean
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
      startAt = startAt ?? now();

      if (
        evaluation.selectedValue === undefined ||
        evaluation.configType === ConfigType.LOG_LEVEL
      ) {
        return;
      }

      const key = JSON.stringify([
        evaluation.configKey,
        evaluation.configType.toString(),
      ]);

      const counter = JSON.stringify([
        evaluation.configId.toString(),
        evaluation.conditionalValueIndex,
        evaluation.configRowIndex,
        Object.keys(evaluation.selectedValue)[0],
        evaluation.unwrappedValue,
        evaluation.weightedValueIndex,
      ]);

      incrementCounter(key, counter);
    },

    sync: async (): Promise<SyncResult | undefined> => {
      if (data.size === 0) {
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

          const counter: ConfigEvaluationCounter = {
            configId: new Long(configId),
            conditionalValueIndex,
            configRowIndex,
            selectedValue: { [valueType]: unwrappedValue },
            count: Long.fromNumber(count),
            weightedValueIndex,
            reason: 0,
          };

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
          start: startAt ?? new Long(Date.now()),
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