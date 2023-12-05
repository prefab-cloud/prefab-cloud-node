import * as fs from "fs";
import type Long from "long";
import type { Config, Configs } from "./proto";
import { maxLong } from "./maxLong";
import type { ApiClient } from "./apiClient";

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
  cdnUrl,
  apiUrl,
  datafile,
  startAtId,
  apiClient,
}: {
  cdnUrl: string;
  apiUrl: string;
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

  try {
    return await loadConfigFromUrl({ url: cdnUrl, startAtId, apiClient });
  } catch (e) {
    console.warn(e);
    return await loadConfigFromUrl({ url: apiUrl, startAtId, apiClient });
  }
}

const extractDefaultContext = (
  rawDefaultContext: Configs["defaultContext"]
): Contexts => {
  const defaultContext: Contexts = new Map();

  for (const context of rawDefaultContext?.contexts ?? []) {
    if (context.type !== undefined) {
      const values = new Map<string, unknown>();

      for (const key of Object.keys(context.values ?? {})) {
        const [value] = unwrapPrimitive(key, context.values[key]);
        values.set(key, value);
      }

      defaultContext.set(context.type, values);
    }
  }

  return defaultContext;
};

const loadConfigFromUrl = async ({
  url,
  startAtId,
  apiClient,
}: {
  url: string;
  startAtId?: Long;
  apiClient: ApiClient;
}): ReturnType<typeof loadConfig> => {
  const response = await apiClient.fetch({
    url: `${url}/api/v1/configs/${startAtId?.toString() ?? 0}`,
  });

  if (response.status === 401) {
    throw new Error("Unauthorized. Check your Prefab SDK API key.");
  }

  if (response.status === 200) {
    const buffer = await response.arrayBuffer();

    const parsed = parseConfigs(buffer);
    return parse(parsed);
  }

  throw new Error(`Something went wrong talking to ${url}. ${response.status}`);
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
