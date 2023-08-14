import { makeToken } from "./makeToken";

const version: string = require("../package.json").version;

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
