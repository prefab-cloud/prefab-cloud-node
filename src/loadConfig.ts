import type Long from "long";
import type { Config, Configs } from "./proto";
import { maxLong } from "./maxLong";
import type { ApiClient } from "./apiClient";

import { unwrap } from "./unwrap";
import type { Contexts, ProjectEnvId } from "./types";
import { parseConfigs } from "./parseProto";

export async function loadConfig({
  cdnUrl,
  apiUrl,
  startAtId,
  apiClient,
}: {
  cdnUrl: string;
  apiUrl: string;
  startAtId?: Long;
  apiClient: ApiClient;
}): Promise<{
  configs: Config[];
  projectEnvId: ProjectEnvId;
  startAtId: Long;
  defaultContext: Contexts;
}> {
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
        const [value] = unwrap(key, context.values[key], undefined);
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
  }

  throw new Error(`Something went wrong talking to ${url}. ${response.status}`);
};
