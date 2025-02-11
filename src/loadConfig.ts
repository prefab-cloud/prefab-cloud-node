import * as fs from "fs";
import type Long from "long";
import type { Config, Configs } from "./proto";
import { maxLong } from "./maxLong";
import { type ApiClient, fetchWithCache } from "./apiClient";

import { unwrapPrimitive } from "./unwrap";
import type { Contexts, ProjectEnvId } from "./types";
import { parseConfigs, parseConfigsFromJSON } from "./parseProto";

interface Result {
  configs: Config[];
  projectEnvId: ProjectEnvId;
  startAtId: Long;
  defaultContext: Contexts;
}

export async function loadConfig({
  sources,
  datafile,
  startAtId,
  apiClient,
}: {
  sources: string[];
  startAtId?: Long;
  apiClient: ApiClient;
  datafile?: string;
}): Promise<Result> {
  if (datafile !== undefined) {
    // Read from file instead of API
    const buffer = fs.readFileSync(datafile);
    const parsed = parseConfigsFromJSON(buffer.toString("utf-8"));
    return await Promise.resolve(parse(parsed));
  }

  const lastSource = sources[sources.length - 1];

  for (const source of sources.slice(0, -1)) {
    try {
      return await loadConfigFromUrl({ source, startAtId, apiClient });
    } catch (e) {
      console.warn(e);
    }
  }

  if (lastSource === undefined) {
    throw new Error("No sources provided");
  }

  return await loadConfigFromUrl({
    source: lastSource,
    startAtId,
    apiClient,
  });
}

const extractDefaultContext = (
  rawDefaultContext: Configs["defaultContext"]
): Contexts => {
  const defaultContext: Contexts = new Map();

  for (const context of rawDefaultContext?.contexts ?? []) {
    if (context.type !== undefined) {
      const values = new Map<string, unknown>();

      for (const key of Object.keys(context.values ?? {})) {
        const { value } = unwrapPrimitive(key, context.values[key]);
        values.set(key, value);
      }

      defaultContext.set(context.type, values);
    }
  }

  return defaultContext;
};

const loadConfigFromUrl = async ({
  source,
  startAtId,
  apiClient,
}: {
  source: string;
  startAtId?: Long;
  apiClient: ApiClient;
  etag?: string;
}): ReturnType<typeof loadConfig> => {
  const path = `/api/v1/configs/${startAtId?.toString() ?? 0}`;
  const response = await fetchWithCache(apiClient, { source, path });

  if (response.status === 401) {
    throw new Error(
      `Unauthorized. Check your Prefab SDK API key for ${source}${path}`
    );
  }

  if (response.status === 200) {
    const buffer = await response.arrayBuffer();
    const parsed = parseConfigs(buffer);
    return parse(parsed);
  }

  throw new Error(
    `Something went wrong talking to ${source}/${path} | ${response.status}`
  );
};

const parse = (parsed: Configs): Result => {
  if (parsed.configServicePointer?.projectEnvId === undefined) {
    throw new Error("No projectEnvId found in config.");
  }

  const configs = parsed.configs ?? [];

  const defaultContext = extractDefaultContext(parsed.defaultContext);

  return {
    configs,
    projectEnvId: parsed.configServicePointer.projectEnvId,
    startAtId: maxLong(configs.map((c) => c.id)),
    defaultContext,
  };
};
