import Long from "long";
import type { Config } from "../../proto";
import { ConfigType } from "../../proto";
import { irrelevantLong } from "../testHelpers";

const config: Config = {
  id: new Long(999),
  projectId: irrelevantLong,
  key: "prefab.secrets.encryption.key",
  changedBy: undefined,
  rows: [
    {
      properties: {},
      values: [
        {
          criteria: [],
          value: {
            string:
              "7ce2dbcc3e0b463c99575bf5b2fc164c51166d065043b9f322bb6d7228b14a3a",
          },
        },
      ],
    },
  ],
  allowableValues: [],
  configType: ConfigType.CONFIG,
  valueType: 2,
};

export default config;
