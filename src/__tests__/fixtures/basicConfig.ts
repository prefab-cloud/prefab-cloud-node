import Long from "long";
import type { Config } from "../../proto";
import { ConfigType } from "../../proto";
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
  draftId: irrelevantLong,
};

export default config;
