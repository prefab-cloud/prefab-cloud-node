import type { Config } from "../../proto";
import { ConfigType } from "../../proto";
import { irrelevantLong, projectEnvIdUnderTest } from "../testHelpers";

const config: Config = {
  id: irrelevantLong,
  projectId: irrelevantLong,
  key: "basic.env",
  changedBy: undefined,
  rows: [
    {
      properties: {},
      projectEnvId: projectEnvIdUnderTest,
      values: [
        {
          criteria: [],
          value: {
            stringList: {
              values: ["a", "b", "c", "d"],
            },
          },
        },
      ],
    },
    {
      properties: {},
      values: [
        {
          criteria: [],
          value: {
            stringList: {
              values: ["no"],
            },
          },
        },
      ],
    },
  ],
  configType: ConfigType.CONFIG,
  allowableValues: [],
  valueType: 10,
};

export default config;
