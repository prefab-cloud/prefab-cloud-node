import type Long from "long";
import { maxLong } from "./maxLong";
import type { ApiClient } from "./apiClient";

import type { Config } from "./proto";
import type { ProjectEnvId } from "./types";
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
}> {
  try {
    return await loadConfigFromUrl({ url: cdnUrl, startAtId, apiClient });
  } catch (e) {
    console.warn(e);
    return await loadConfigFromUrl({ url: apiUrl, startAtId, apiClient });
  }
}

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

    return {
      configs,
      projectEnvId: parsed.configServicePointer.projectEnvId,
      startAtId: maxLong(configs.map((c) => c.id)),
    };
  }

  throw new Error(`Something went wrong talking to ${url}. ${response.status}`);
};
