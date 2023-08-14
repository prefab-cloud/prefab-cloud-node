import { makeHeaders } from "./makeHeaders";
import type Long from "long";
import { maxLong } from "./maxLong";

import type { Config } from "./proto";
import type { ProjectEnvId } from "./types";
import { parseConfigs } from "./parseConfigs";

const version: string = require("../package.json").version;

export async function loadConfig({
  apiKey,
  cdnUrl,
  apiUrl,
  startAtId,
  fetch = globalThis.fetch,
}: {
  apiKey: string;
  cdnUrl: string;
  apiUrl: string;
  startAtId?: Long;
  fetch?: typeof globalThis.fetch;
}): Promise<{
  configs: Config[];
  projectEnvId: ProjectEnvId;
  startAtId: Long;
}> {
  try {
    return await loadConfigFromUrl({ apiKey, url: cdnUrl, startAtId, fetch });
  } catch (e) {
    console.warn(e);
    return await loadConfigFromUrl({ apiKey, url: apiUrl, startAtId, fetch });
  }
}

const loadConfigFromUrl = async ({
  apiKey,
  url,
  startAtId,
  fetch,
}: {
  apiKey: string;
  url: string;
  startAtId?: Long;
  fetch: typeof window.fetch;
}): ReturnType<typeof loadConfig> => {
  const headers = {
    ...makeHeaders(apiKey),
    "Content-Type": "application/x-protobuf",
    Accept: "application/x-protobuf",
    "X-PrefabCloud-Client-Version": `prefab-cloud-node-${version}`,
  };

  const response = await fetch(
    `${url}/api/v1/configs/${startAtId?.toString() ?? 0}`,
    {
      headers,
    }
  );

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
