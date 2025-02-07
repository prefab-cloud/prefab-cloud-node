import Long from "long";
import {
  type Config,
  Config_ValueType,
  ConfigType,
  type Criterion_CriterionOperator,
} from "../../proto";
import { irrelevantLong } from "../testHelpers";

const createConfig = (
  key: string,
  propertyName: string,
  valueToMatch: string,
  operator:
    | Criterion_CriterionOperator.PROP_MATCHES
    | Criterion_CriterionOperator.PROP_DOES_NOT_MATCH
): Config => {
  return {
    id: new Long(999),
    projectId: irrelevantLong,
    key,
    changedBy: undefined,
    rows: [
      {
        properties: {},
        values: [
          {
            criteria: [
              {
                propertyName,
                operator,
                valueToMatch: {
                  string: valueToMatch,
                },
              },
            ],
            value: {
              bool: true,
            },
          },
          {
            criteria: [],
            value: {
              bool: false,
            },
          },
        ],
      },
    ],
    allowableValues: [],
    configType: ConfigType.CONFIG,
    valueType: Config_ValueType.BOOL,
    sendToClientSdk: false,
  };
};

export { createConfig };
