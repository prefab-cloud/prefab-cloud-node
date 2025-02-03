import Long from "long";
import {type Config, Config_ValueType, ConfigType, Criterion_CriterionOperator} from "../../proto";
import {irrelevantLong} from "../testHelpers";

const config: Config = {
  id: new Long(999),
  projectId: irrelevantLong,
  key: "prop.after",
  changedBy: undefined,
  rows: [
    {
      properties: {},
      values: [
        {
          criteria: [
            {
              propertyName: "user.createdAt",
              operator: Criterion_CriterionOperator.PROP_AFTER,
              valueToMatch: {
                int: Long.fromNumber(1738359581000) // 2025-01-31 21:39:41
              }
            }
          ],
          value: {
            bool: true,
          },
        },
        {
          criteria: [],
          value: {
            bool: false
          }
        },
      ],
    },
  ],
  allowableValues: [],
  configType: ConfigType.CONFIG,
  valueType: Config_ValueType.BOOL,
  sendToClientSdk: false,
};

export default config;
