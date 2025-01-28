import {Config, Config_ValueType, ConfigType} from "../../proto";
import {irrelevantLong, projectEnvIdUnderTest} from "../testHelpers";

const config: Config = {
  id: irrelevantLong,
  projectId: irrelevantLong,
  key: "rollout.flag",
  changedBy: undefined,
  rows: [
    {
      properties: {},
      projectEnvId: irrelevantLong,
      values: [
        {
          criteria: [],
          value: {
            bool: false,
          },
        },
      ],
    },
    {
      properties: {},
      projectEnvId: projectEnvIdUnderTest,
      values: [
        {
          criteria: [],
          value: {
            weightedValues: {
              weightedValues: [
                {
                  weight: 90,
                  value: {
                    bool: false,
                  },
                },
                {
                  weight: 10,
                  value: {
                    bool: true,
                  },
                },
              ],
              hashByPropertyName: "user.trackingId",
            },
          },
        },
      ],
    },
  ],
  allowableValues: [
    {
      bool: false,
    },
    {
      bool: true,
    },
  ],
  configType: ConfigType.FEATURE_FLAG,
  valueType: Config_ValueType.BOOL,
  sendToClientSdk: false,
};

export default config;
