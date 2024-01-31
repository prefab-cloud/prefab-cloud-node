import Long from "long";
import type { Config } from "../../proto";
import { ConfigType, LogLevel } from "../../proto";
import { irrelevantLong } from "../testHelpers";

const config: Config = {
  id: new Long(33),
  projectId: irrelevantLong,
  key: "log-level.some.component.path",
  changedBy: undefined,
  rows: [
    {
      properties: {},
      values: [
        {
          criteria: [],
          value: {
            logLevel: LogLevel.INFO,
          },
        },
      ],
    },
  ],
  allowableValues: [],
  configType: ConfigType.LOG_LEVEL,
  valueType: 9,
  sendToClientSdk: false,
};

export default config;
