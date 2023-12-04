import type { Config } from "../../proto";
import { ConfigType, Criterion_CriterionOperator } from "../../proto";
import { irrelevantLong, projectEnvIdUnderTest } from "../testHelpers";

const config: Config = {
  id: irrelevantLong,
  projectId: irrelevantLong,

  key: "prop.is.not.one.of",
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
              propertyName: "user.country",
              operator: Criterion_CriterionOperator.PROP_IS_NOT_ONE_OF,
              valueToMatch: {
                stringList: {
                  values: ["US", "UK"],
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
      string: "correct",
    },
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
