import { makeToken } from "./makeToken";
import { version } from "../package.json";

export const makeHeaders = (
  apiKey: string,
  other?: Record<string, string>
): Record<string, string> => {
  const token = makeToken(apiKey);

  return {
    Authorization: `Basic ${token}`,
    "X-PrefabCloud-Client-Version": `prefab-cloud-node-${version}`,
    ...(other ?? {}),
  };
};
