import type { Config } from "../../proto";
import { ConfigType, Criterion_CriterionOperator } from "../../proto";
import { irrelevantLong, projectEnvIdUnderTest } from "../testHelpers";

const config: Config = {
  id: irrelevantLong,
  projectId: irrelevantLong,

  key: "prop.is.one.of.and.ends.with",
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
              operator: Criterion_CriterionOperator.PROP_IS_ONE_OF,
              valueToMatch: {
                stringList: {
                  values: ["US", "UK"],
                },
              },
            },
            {
              propertyName: "user.email",
              operator: Criterion_CriterionOperator.PROP_ENDS_WITH_ONE_OF,
              valueToMatch: {
                stringList: {
                  values: ["@prefab.cloud"],
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
  sendToClientSdk: false,
};
export default config;
