import type { Config } from "../../proto";
import { ConfigType, LogLevel } from "../../proto";
import { irrelevantLong } from "../testHelpers";

const config: Config = {
  id: irrelevantLong,
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
  draftId: irrelevantLong,
};

export default config;
