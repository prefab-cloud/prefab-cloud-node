import type { Config } from "../../proto";
import { ConfigType } from "../../proto";
import { irrelevantLong } from "../testHelpers";

const config: Config = {
  id: irrelevantLong,
  projectId: irrelevantLong,
  key: "basic.flag",
  changedBy: undefined,
  rows: [
    {
      properties: {},
      values: [
        {
          criteria: [],
          value: {
            bool: true,
          },
        },
      ],
    },
  ],
  allowableValues: [{ bool: true }, { bool: false }],
  configType: ConfigType.FEATURE_FLAG,
  draftId: irrelevantLong,
};

export default config;
