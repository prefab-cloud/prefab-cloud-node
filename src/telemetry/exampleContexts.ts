import Long from "long";
import type { ContextUploadMode, SyncResult, Telemetry } from "./types";
import type { ApiClient } from "../apiClient";
import type { Contexts } from "../types";
import { rateLimitCache } from "./rateLimitCache";
import { encode } from "../parseProto";
import type {
  ConfigValue,
  Context,
  ExampleContext,
  TelemetryEvent,
  TelemetryEvents,
} from "../proto";
import { wrap } from "../wrap";

const ENDPOINT = "/api/v1/telemetry";

const MAX_DATA_SIZE = 10000;

type SeenContext = [number, Contexts];

type ExampleContextsTelemetry = Telemetry & {
  data: SeenContext[];
  push: (contexts: Contexts) => void;
  cache?: ReturnType<typeof rateLimitCache>;
};

export const stub: ExampleContextsTelemetry = {
  enabled: false,
  sync: async () => undefined,
  timeout: undefined,
  data: [],
  push: () => {},
};

const groupedKey = (contexts: Contexts): string => {
  return Array.from(contexts.values())
    .map((context) => {
      const key = context.get("key") ?? context.get("trackingId");
      return typeof key === "string" ? key : JSON.stringify(key);
    })
    .filter((str) => str?.length > 0)
    .sort()
    .join("|");
};

const contextsToProto = (contexts: Contexts): Context[] => {
  return Array.from(contexts.entries()).map(([key, context]) => {
    const valueProtos: Record<string, ConfigValue> = {};

    Array.from(context.entries()).forEach(([key, value]) => {
      valueProtos[key] = wrap(value);
    });

    const contextProto: Context = {
      type: key,
      values: valueProtos,
    };

    return contextProto;
  });
};

export const exampleContexts = (
  apiClient: ApiClient,
  telemetryHost: string | undefined,
  instanceHash: string,
  contextUploadMode: ContextUploadMode,
  maxDataSize: number = MAX_DATA_SIZE
): ExampleContextsTelemetry => {
  if (contextUploadMode !== "periodicExample") {
    return stub;
  }

  const cache = rateLimitCache(60 * 60 * 1000);

  const data: SeenContext[] = [];

  return {
    enabled: true,

    data,

    timeout: undefined,

    cache,

    push(contexts: Contexts) {
      if (telemetryHost === undefined) {
        return;
      }

      if (data.length >= maxDataSize) {
        return;
      }

      const key = groupedKey(contexts);

      if (key.length === 0) {
        return;
      }

      if (!cache.isFresh(key)) {
        data.push([Date.now(), contexts]);
        cache.set(key);
      }
    },

    async sync(): Promise<SyncResult | undefined> {
      if (data.length === 0 || telemetryHost === undefined) {
        return undefined;
      }

      const examples: ExampleContext[] = data.map(([timestamp, contexts]) => {
        return {
          timestamp: Long.fromNumber(timestamp),
          contextSet: {
            contexts: contextsToProto(contexts),
          },
        };
      });

      data.length = 0;
      cache.prune();

      const event: TelemetryEvent = {
        exampleContexts: {
          examples,
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
