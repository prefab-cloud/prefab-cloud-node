import Long from "long";
import type { Config } from "../../proto";
import { ConfigType, Criterion_CriterionOperator } from "../../proto";
import { irrelevantLong, projectEnvIdUnderTest } from "../testHelpers";

const config: Config = {
  id: new Long(991),
  projectId: irrelevantLong,

  key: "prop.is.one.of",
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
              propertyName: "prefab.user-id",
              operator: Criterion_CriterionOperator.PROP_IS_ONE_OF,
              valueToMatch: {
                stringList: {
                  values: ["4", "5"],
                },
              },
            },
          ],
          value: {
            string: "context-override",
          },
        },
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
          ],
          value: {
            string: "correct",
          },
        },
        {
          criteria: [
            {
              propertyName: "user.trackingId",
              operator: Criterion_CriterionOperator.PROP_IS_ONE_OF,
              valueToMatch: {
                stringList: {
                  values: ["CONFIDENTIAL"],
                },
              },
            },
          ],
          value: {
            confidential: true,
            string: "For British Eyes Only",
          },
        },
        {
          criteria: [
            {
              propertyName: "user.trackingId",
              operator: Criterion_CriterionOperator.PROP_IS_ONE_OF,
              valueToMatch: {
                stringList: {
                  values: ["SECRET"],
                },
              },
            },
          ],
          value: {
            decryptWith: "prefab.secrets.encryption.key",
            string:
              "8933c39f7f73b6e815dfbe--b3f5216809e719efd8803dad--b16761b9418d8145a98f88a631681298",
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
  sendToClientSdk: false,
};
export default config;
