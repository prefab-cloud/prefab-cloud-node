import protobuf from "protobufjs/light";
import type Long from "long";
import protoJSON from "./proto.json";

import type { Configs, Config } from "./proto";

const root = protobuf.Root.fromJSON(protoJSON);

export async function loadConfig(
  apiKey: string,
  cdnUrl: string
): Promise<{ configs: Config[]; projectEnvId: Long }> {
  const token = Buffer.from(`authuser:${apiKey}`).toString("base64");

  const headers = {
    Authorization: `Basic ${token}`,
    "Content-Type": "application/x-protobuf",
    Accept: "application/x-protobuf",
  };

  const response = await fetch(`${cdnUrl}/api/v1/configs/0`, { headers });

  if (response.status === 401) {
    throw new Error("Unauthorized. Check your Prefab SDK API key.");
  }

  if (response.status === 200) {
    const buffer = await response.arrayBuffer();
    // @ts-expect-error - there's something amiss here since moduleResolution was specified
    const parsed = root
      .lookupType("prefab.Configs")
      .decode(Buffer.from(buffer)) as Configs;

    if (parsed.configServicePointer?.projectEnvId === undefined) {
      throw new Error("No projectEnvId found in config.");
    }

    return {
      configs: parsed.configs ?? [],
      // TODO: will need start_at_id, etc. later
      projectEnvId: parsed.configServicePointer.projectEnvId,
    };
  }

  // TODO
  throw new Error("Something went wrong.");
}
