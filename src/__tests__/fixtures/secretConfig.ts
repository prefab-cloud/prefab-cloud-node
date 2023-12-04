import Long from "long";
import type { Config } from "../../proto";
import { ConfigType } from "../../proto";
import { irrelevantLong } from "../testHelpers";

const config = (encryptedValue: string): Config => ({
  id: new Long(51),
  projectId: irrelevantLong,
  key: "secret.config",
  changedBy: undefined,
  rows: [
    {
      properties: {},
      values: [
        {
          criteria: [],
          value: {
            string: encryptedValue,
            confidential: true,
            decryptWith: "prefab.secrets.encryption.key",
          },
        },
      ],
    },
  ],
  allowableValues: [],
  configType: ConfigType.CONFIG,
  valueType: 2,
});

export default config;
