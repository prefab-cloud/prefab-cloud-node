import Long from "long";
import type { Logger, Loggers } from "../proto";
import type { ApiClient } from "../apiClient";
import { encode } from "../parseProto";
import type { ValidLogLevelName } from "../logger";
import { now } from "./reporter";
import type { SyncResult, Telemetry } from "./types";

const ENDPOINT = "/api/v1/known-loggers";

const MAX_DATA_SIZE = 10000;

type KnownLogger = Telemetry & {
  data: Record<string, Record<string, number>>;
  push: (loggerName: string, severity: number) => void;
};

export const stub: KnownLogger = {
  enabled: false,
  data: {},
  push() {},
  sync: async () => undefined,
  timeout: undefined,
};

type Pluralize<S extends string> = `${S}s`;

export type LoggerLevelName = Pluralize<ValidLogLevelName>;

const NUMBER_LEVEL_LOOKUP: Record<string, LoggerLevelName> = {
  1: "traces",
  2: "debugs",
  3: "infos",
  5: "warns",
  6: "errors",
  9: "fatals",
};

export const knownLoggers = (
  apiClient: ApiClient,
  telemetryHost: string | undefined,
  instanceHash: string,
  collectLoggerCounts: boolean,
  namespace?: string,
  maxDataSize: number = MAX_DATA_SIZE
): KnownLogger => {
  if (!collectLoggerCounts) {
    return stub;
  }

  const data: Record<string, Record<string, number>> = {};
  let startAt: Long | undefined;

  return {
    enabled: true,

    data,

    timeout: undefined,

    push(loggerName: string, severity: number) {
      if (telemetryHost === undefined) {
        return;
      }

      startAt = startAt ?? now();

      if (data[loggerName] == null) {
        if (Object.keys(data).length >= maxDataSize) {
          return;
        }

        data[loggerName] = {};
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      (data[loggerName] as Record<string, number>)[severity] =
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        ((data[loggerName] as Record<string, number>)[severity] ?? 0) + 1;
    },

    async sync(): Promise<SyncResult | undefined> {
      if (Object.keys(data).length === 0 || telemetryHost === undefined) {
        return;
      }

      const loggers = Object.keys(data).map((loggerName) => {
        const logger: Logger = { loggerName };

        const record = data[loggerName] ?? {};

        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete data[loggerName];

        Object.keys(record).forEach((severity) => {
          const key: LoggerLevelName | undefined =
            NUMBER_LEVEL_LOOKUP[severity];

          if (key !== undefined) {
            logger[key] = Long.fromNumber(record[severity] ?? 0);
          }
        });

        return logger;
      });

      const apiData: Loggers = {
        loggers,
        startAt: startAt ?? Long.fromNumber(Date.now()),
        endAt: now(),
        instanceHash,
      };

      if (namespace !== undefined) {
        apiData.namespace = namespace;
      }

      const result = await apiClient.fetch({
        source: telemetryHost,
        path: ENDPOINT,
        options: {
          method: "POST",
          body: encode("Loggers", apiData),
        },
      });

      startAt = undefined;

      return {
        status: result.status,
        dataSent: apiData,
      };
    },
  };
};
