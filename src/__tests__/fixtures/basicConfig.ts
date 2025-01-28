import Long from "long";
import { type Config, Config_ValueType, ConfigType } from "../../proto";
import { irrelevantLong } from "../testHelpers";

const config: Config = {
  id: new Long(999),
  projectId: irrelevantLong,
  key: "basic.value",
  changedBy: undefined,
  rows: [
    {
      properties: {},
      values: [
        {
          criteria: [],
          value: {
            int: new Long(42),
          },
        },
      ],
    },
  ],
  allowableValues: [],
  configType: ConfigType.CONFIG,
  valueType: Config_ValueType.INT,
  sendToClientSdk: false,
};

export default config;
