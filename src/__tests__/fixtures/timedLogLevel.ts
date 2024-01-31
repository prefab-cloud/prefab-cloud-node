import Long from "long";
import type { Config } from "../../proto";
import { ConfigType, Criterion_CriterionOperator, LogLevel } from "../../proto";
import { irrelevantLong } from "../testHelpers";

const config = (start: number, end: number): Config => ({
  id: Long.fromNumber(33),
  projectId: irrelevantLong,
  key: "log-level.some.component.path",
  changedBy: undefined,
  rows: [
    {
      properties: {},
      values: [
        {
          criteria: [
            {
              propertyName: "prefab.current-time",
              operator: Criterion_CriterionOperator.IN_INT_RANGE,
              valueToMatch: {
                intRange: {
                  start: Long.fromValue(start),
                  end: Long.fromValue(end),
                },
              },
            },
          ],
          value: { logLevel: LogLevel.DEBUG },
        },
        {
          criteria: [],
          value: { logLevel: LogLevel.INFO },
        },
      ],
    },
  ],
  allowableValues: [],
  configType: ConfigType.LOG_LEVEL,
  valueType: 9,
  sendToClientSdk: false,
});

export default config;
