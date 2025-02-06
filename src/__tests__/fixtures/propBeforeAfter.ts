import Long from "long";
import {
  type Config,
  Config_ValueType,
  ConfigType,
  Criterion_CriterionOperator,
} from "../../proto";
import { irrelevantLong } from "../testHelpers";

function createConfig(
  key: string,
  valueToMatch: object,
  operator:
    | Criterion_CriterionOperator.PROP_BEFORE
    | Criterion_CriterionOperator.PROP_AFTER
): Config {
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
                propertyName: "user.createdAt",
                operator,
                valueToMatch, // Directly use the passed object
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
}

export const epochMillis = Long.fromNumber(1738359581000);
export const dateString = "2025-01-31T21:39:41Z";
export const configAfterWithInt = createConfig(
  "prop.after",
  { int: epochMillis },
  Criterion_CriterionOperator.PROP_AFTER
); // int type
export const configAfterWithString = createConfig(
  "prop.after",
  { string: dateString },
  Criterion_CriterionOperator.PROP_AFTER
); // string type
export const configBeforeWithInt = createConfig(
  "prop.before",
  { int: epochMillis },
  Criterion_CriterionOperator.PROP_BEFORE
); // int type
export const configBeforeWithString = createConfig(
  "prop.before",
  { string: dateString },
  Criterion_CriterionOperator.PROP_BEFORE
); // string type
