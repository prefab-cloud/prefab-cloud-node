import Long from "long";
import {Config, Config_ValueType, ConfigType, Criterion_CriterionOperator} from "../../proto";
import {irrelevantLong, projectEnvIdUnderTest} from "../testHelpers";

const config: Config = {
  id: new Long(992),
  projectId: irrelevantLong,

  key: "prop.is.one.of.jsonValue",
  changedBy: undefined,
  rows: [
    {
      properties: {},
      projectEnvId: irrelevantLong,
      values: [
        {
          criteria: [],
          value: {
            json: {
              json: JSON.stringify({"result": "wrong projectEnvId"}),
            }
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
            json: {
              json: JSON.stringify({"result": "context-override"}),
            }
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
            json: {
              json: JSON.stringify({"result": "correct"})
            }
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
            json: {
              json: JSON.stringify({"result": "encrypted"})
            }
          },
        },
        {
          criteria: [],
          value: {
            json: {
              json: JSON.stringify({"result": "default"})
            }
          },
        },
      ],
    },
  ],
  allowableValues: [
    {
      json: {
        json: JSON.stringify({"result": "default"})
      }
    },
    {
      json: {
        json: JSON.stringify({"result": "encrypted"})
      }
    },
    {
      json: {
        json: JSON.stringify({"result": "correct"})
      },
    },
    {
      json: {
        json: JSON.stringify({"result": "context-override"}),
      }
    },
    {
      json: {
        json: JSON.stringify({"result": "wrong projectEnvId"}),
      }
    }
  ],
  configType: ConfigType.CONFIG,
  valueType: Config_ValueType.JSON,
  sendToClientSdk: false,
};
export default config;
