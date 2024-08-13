import type { ContextShape, ContextShapes } from "../proto";
import type { Contexts } from "../types";
import { encode } from "../parseProto";
import type { ApiClient } from "../apiClient";
import type { ContextUploadMode, SyncResult, Telemetry } from "./types";

const ENDPOINT = "/api/v1/context-shapes";

const MAX_DATA_SIZE = 10000;

type ContextShapeTelemetry = Telemetry & {
  data: Map<string, Record<string, number>>;
  push: (contexts: Contexts) => void;
};

export const stub: ContextShapeTelemetry = {
  enabled: false,
  sync: async () => undefined,
  timeout: undefined,
  data: new Map<string, Record<string, number>>(),
  push() {},
};

export const fieldTypeForValue = (value: unknown): number => {
  if (Number.isInteger(value)) {
    return 1;
  }

  if (typeof value === "number") {
    return 4;
  }

  if (typeof value === "boolean") {
    return 5;
  }

  if (Array.isArray(value)) {
    return 10;
  }

  return 2;
};

export const contextShapes = (
  apiClient: ApiClient,
  telemetryHost: string | undefined,
  contextUploadMode: ContextUploadMode,
  namespace?: string,
  maxDataSize: number = MAX_DATA_SIZE
): ContextShapeTelemetry => {
  if (contextUploadMode === "none") {
    return stub;
  }

  const data = new Map<string, Record<string, number>>();

  return {
    enabled: true,

    data,

    timeout: undefined,

    push(contexts: Contexts) {
      if (telemetryHost === undefined) {
        return;
      }

      contexts.forEach((context, name) => {
        context.forEach((value, key) => {
          let shape = data.get(name);

          if (shape === undefined && data.size >= maxDataSize) {
            return;
          }

          shape = shape ?? {};

          if (shape[key] === undefined) {
            shape[key] = fieldTypeForValue(value);
            data.set(name, shape);
          }
        });
      });
    },

    async sync(): Promise<SyncResult | undefined> {
      if (data.size === 0 || telemetryHost === undefined) {
        return;
      }

      const shapes: ContextShape[] = [];

      data.forEach((shape, name) => {
        shapes.push({
          name,
          fieldTypes: shape,
        });

        data.delete(name);
      });

      const apiData: ContextShapes = {
        shapes,
      };

      if (namespace !== undefined) {
        apiData.namespace = namespace;
      }

      const body = encode("ContextShapes", apiData);

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
