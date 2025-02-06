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
    | Criterion_CriterionOperator.PROP_LESS_THAN
    | Criterion_CriterionOperator.PROP_LESS_THAN_OR_EQUAL
    | Criterion_CriterionOperator.PROP_GREATER_THAN
    | Criterion_CriterionOperator.PROP_GREATER_THAN_OR_EQUAL
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
                propertyName,
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
export const propertyName: string = "organization.memberCount";
export const testValueLong = Long.fromInt(100);
export const testValueDouble = 100.0;
export const configLessThanInt = createConfig(
  "prop.lessThanInt",
  { int: testValueLong },
  Criterion_CriterionOperator.PROP_LESS_THAN
); // int type
export const configLessThanDouble = createConfig(
  "prop.lessThanDouble",
  { double: testValueDouble },
  Criterion_CriterionOperator.PROP_LESS_THAN
);
export const configLessThanEqualInt = createConfig(
  "prop.lessThanEqualInt",
  { int: testValueLong },
  Criterion_CriterionOperator.PROP_LESS_THAN_OR_EQUAL
); // int type
export const configLessThanEqualDouble = createConfig(
  "prop.lessThanEqualDouble",
  { double: testValueDouble },
  Criterion_CriterionOperator.PROP_LESS_THAN_OR_EQUAL
);
export const configGreaterThanInt = createConfig(
  "prop.greaterThanInt",
  { int: testValueLong },
  Criterion_CriterionOperator.PROP_GREATER_THAN
); // int type
export const configGreaterThanDouble = createConfig(
  "prop.greaterThanDouble",
  { double: testValueDouble },
  Criterion_CriterionOperator.PROP_GREATER_THAN
);
export const configGreaterThanEqualInt = createConfig(
  "prop.greaterThanEqualInt",
  { int: testValueLong },
  Criterion_CriterionOperator.PROP_GREATER_THAN_OR_EQUAL
); // int type
export const configGreaterThanEqualDouble = createConfig(
  "prop.greaterThanEqualDouble",
  { double: testValueDouble },
  Criterion_CriterionOperator.PROP_GREATER_THAN_OR_EQUAL
);
