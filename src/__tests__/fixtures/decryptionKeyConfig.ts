import type { Config } from "../../proto";
import { ConfigType } from "../../proto";
import { irrelevantLong } from "../testHelpers";

export const decryptionKeyForSecret = (secret: Config): string => {
  const decryptWith = secret.rows[0]?.values[0]?.value?.decryptWith;

  if (decryptWith === undefined) {
    throw new Error("decryptWith was undefined");
  }

  return decryptWith;
};

const config = (secret: Config, decryptionKey: string): Config => {
  const decryptWith = decryptionKeyForSecret(secret);

  return {
    id: irrelevantLong,
    projectId: irrelevantLong,
    key: decryptWith,
    changedBy: undefined,
    rows: [
      {
        properties: {},
        values: [
          {
            criteria: [],
            value: {
              string: decryptionKey,
              confidential: true,
            },
          },
        ],
      },
    ],
    allowableValues: [],
    configType: ConfigType.CONFIG,
    valueType: 2,
    sendToClientSdk: false,
  };
};

export default config;
