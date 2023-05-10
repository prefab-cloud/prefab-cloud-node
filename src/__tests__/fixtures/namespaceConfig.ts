import type { Config } from "../../proto";
import { ConfigType, Criterion_CriterionOperator } from "../../proto";
import { irrelevantLong } from "../testHelpers";

const config: Config = {
  id: irrelevantLong,
  projectId: irrelevantLong,
  key: "basic.namespace",
  changedBy: undefined,
  rows: [
    {
      properties: {},
      values: [
        {
          criteria: [
            {
              operator: Criterion_CriterionOperator.HIERARCHICAL_MATCH,
              propertyName: "NAMESPACE",
              valueToMatch: {
                string: "wrong-namespace",
              },
            },
          ],
          value: {
            stringList: {
              values: ["wrong-namespace"],
            },
          },
        },
        {
          criteria: [
            {
              operator: Criterion_CriterionOperator.HIERARCHICAL_MATCH,
              propertyName: "NAMESPACE",
              valueToMatch: {
                string: "my-namespace",
              },
            },
          ],
          value: {
            stringList: {
              values: ["in-namespace"],
            },
          },
        },
        {
          criteria: [],
          value: {
            stringList: {
              values: ["not-in-namespace"],
            },
          },
        },
      ],
    },
  ],
  configType: ConfigType.CONFIG,
  draftId: irrelevantLong,
  allowableValues: [],
};
export default config;
