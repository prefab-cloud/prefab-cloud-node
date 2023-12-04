import type { Config } from "../../proto";
import { ConfigType, Criterion_CriterionOperator } from "../../proto";
import { irrelevantLong, projectEnvIdUnderTest } from "../testHelpers";

const config: Config = {
  id: irrelevantLong,
  projectId: irrelevantLong,

  key: "prop.ends.with",
  changedBy: undefined,
  rows: [
    {
      properties: {},
      projectEnvId: irrelevantLong,
      values: [
        {
          criteria: [],
          value: {
            string: "wrong projectEnvId",
          },
        },
      ],
    },
    {
      properties: {},
      projectEnvId: projectEnvIdUnderTest,
      values: [
        {
          criteria: [
            {
              propertyName: "user.email",
              operator: Criterion_CriterionOperator.PROP_ENDS_WITH_ONE_OF,
              valueToMatch: {
                stringList: {
                  values: ["@prefab.cloud", "@example.com"],
                },
              },
            },
          ],
          value: {
            string: "correct",
          },
        },
        {
          criteria: [],
          value: {
            string: "default",
          },
        },
      ],
    },
  ],
  allowableValues: [
    {
      string: "wrong projectEnvId",
    },
    {
      string: "default",
    },
  ],
  configType: ConfigType.CONFIG,
  valueType: 2,
};
export default config;
