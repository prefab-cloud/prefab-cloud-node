import type Long from "long";
import type { Prefab } from "../prefab";
import { wordLevelToNumber } from "../prefab";
import type { Context, Contexts, ContextValue } from "../types";
import type { ContextShapes, Logger, Loggers, TelemetryEvents } from "../proto";
import type { knownLoggers, LoggerLevelName } from "../telemetry/knownLoggers";
import type { contextShapes } from "../telemetry/contextShapes";
import type { exampleContexts } from "../telemetry/exampleContexts";
import { unwrapPrimitive } from "../unwrap";
import fs from "fs";
import { type ValidLogLevelName, PREFIX } from "../logger";

process.env[
  `PREFAB_INTEGRATION_TEST_ENCRYPTION_KEY`
] = `c87ba22d8662282abe8a0e4651327b579cb64a454ab0f4c170b45b15f049a221`;
process.env[`NOT_A_NUMBER`] = `not a number`;
process.env[`IS_A_NUMBER`] = "1234";

const IGNORED_CLIENT_OVERRIDES_FOR_INPUT_OUTPUT_TESTS = [
  "initialization_timeout_sec",
  "prefab_api_url",
  "on_init_failure",
];

const HANDLED_CLIENT_OVERRIDES_FOR_INPUT_OUTPUT_TESTS = [
  "namespace",
  "on_no_default",
];

const HANDLED_CLIENT_OVERRIDES_FOR_TELEMETRY_TESTS = ["context_upload_mode"];

const YAML = require("yaml");

const testDataPath = `./prefab-cloud-integration-test-data`;

const testsPath = `${testDataPath}/tests/current`;

const expectedWarnings: Record<string, RegExp> = {
  "always returns false for a non-boolean flag":
    /Non-boolean FF's return `false` for isFeatureEnabled checks./,
};

const typeLookup: Record<number, string> = {
  1: "CONFIG",
  2: "FEATURE_FLAG",
  3: "LOG_LEVEL",
  4: "SEGMENT",
};

const logLevelLookup: Record<string, number> = {
  TRACE: 1,
  DEBUG: 2,
  INFO: 3,
  WARN: 5,
  ERROR: 6,
  FATAL: 9,
};

type YAMLContext = Record<string, Record<string, any>> | undefined;

type RawAggregator =
  | "log_path"
  | "context_shape"
  | "evaluation_summary"
  | "example_contexts";

type Aggregator =
  | "knownLoggers"
  | "contextShapes"
  | "evaluationSummaries"
  | "exampleContexts";

interface RawTestSuite {
  name: string;
  fileName: string;
  context: YAMLContext;
  cases: Array<RawInputOutputTestCase | RawTelemetryTestCase>;
}

interface RawInputOutputTestCase {
  name: string;
  client: string;
  function: "enabled" | "get" | "get_or_raise";
  type: string;
  input: {
    key?: string;
    flag?: string;
    default?: any;
    context: YAMLContext;
  };
  expected: {
    value: any;
    status?: "raise";
    message?: string;
    millis?: number;
  };
  client_overrides: {
    namespace?: string;
    on_no_default?: 2;
    initialization_timeout_sec?: number;
  };
}

interface RawTelemetryTestCase {
  name: string;
  client: string;
  function: "post";
  type: string;
  data: Record<string, any> | Array<Record<string, any>> | string[];
  expected_data: Record<string, any>;
  aggregator: RawAggregator;
  client_overrides?: {
    collect_sync_interval?: number;
    context_upload_mode?: string;
  };
}

export interface InputOutputTest {
  name: string;
  parentContext: Contexts | undefined;
  context: Contexts | undefined;
  client: string;
  function: string;
  expectedWarning: RegExp | undefined;
  input: {
    key?: string;
    flag?: string;
    default?: any;
    context?: Record<string, Record<string, any>>;
  };
  expected: {
    value: any;
    status?: "raise";
    message?: string;
  };
  client_overrides: {
    namespace?: string;
    on_no_default?: 2;
    initialization_timeout_sec?: number;
  };
}

export interface TelemetryTest {
  name: string;
  data: Array<Record<string, any>> | string[];
  function: "post";
  type: string;
  expectedTelemetryData: Record<string, any>;
  aggregator: Aggregator;
  customOptions: {
    contextUploadMode?: "shapeOnly" | "periodicExample" | "none";
  };
  exercise: (aggregator: unknown, prefab: Prefab) => void;
  massageData: (dataSent: unknown) => unknown;
}

const aggregatorLookup: Record<RawAggregator, Aggregator> = {
  log_path: "knownLoggers",
  context_shape: "contextShapes",
  evaluation_summary: "evaluationSummaries",
  example_contexts: "exampleContexts",
};

const formatContext = (
  context: Record<string, Record<string, any>>
): Contexts => {
  const builder: Contexts = new Map();

  Object.entries(context).forEach(([key, value]) => {
    builder.set(key, new Map(Object.entries(value)));
  });

  return builder;
};

const testsFromYAML = (fileName: string): RawTestSuite[] => {
  return YAML.parse(
    fs.readFileSync(`${testsPath}/${fileName}`, "utf8")
  ).tests.map((suite: RawTestSuite[]) => {
    return { ...suite, fileName };
  });
};

const contextMaybe = (context: YAMLContext): Contexts | undefined => {
  return context !== undefined ? formatContext(context) : undefined;
};

const calcExpectedValue = (
  testCase: RawInputOutputTestCase,
  key: string
): any => {
  if (testCase.expected === undefined) {
    return undefined;
  }

  let expectedValue = testCase.expected.value;

  if (expectedValue === null) {
    expectedValue = undefined;
  }

  if (key.startsWith(PREFIX)) {
    expectedValue = logLevelLookup[expectedValue];
  }

  if (testCase.type === "DURATION") {
    expectedValue = testCase.expected.millis;
  }

  return expectedValue;
};

const coerceContexts = (
  incomingContexts: Record<string, Record<string, any>>
): Contexts => {
  const contexts: Contexts = new Map();

  Object.keys(incomingContexts).forEach((contextName) => {
    const incomingContext = incomingContexts[contextName];

    if (typeof incomingContext !== "object") {
      throw new Error(
        `Invalid context: ${contextName} is not an object: ${
          incomingContext ?? `undefined`
        }`
      );
    }

    const context: Context = new Map<string, ContextValue>(
      Object.entries(incomingContext)
    );

    contexts.set(contextName, context);
  });

  return contexts;
};

const aggregatorSpecificLogic = {
  contextShapes(data: TelemetryTest["data"]) {
    return {
      exercise: (aggregator: unknown) => {
        data.forEach((data: unknown) => {
          const contexts = coerceContexts(
            data as Record<string, Record<string, any>>
          );

          (aggregator as ReturnType<typeof contextShapes>).push(contexts);
        });
      },

      massageData: (dataSent: unknown) => {
        return (dataSent as ContextShapes).shapes.map(
          ({ name, fieldTypes }) => {
            return {
              name,
              field_types: fieldTypes,
            };
          }
        );
      },
    };
  },

  exampleContexts(data: TelemetryTest["data"]) {
    return {
      exercise: (aggregator: unknown) => {
        data.forEach((data: unknown) => {
          const contexts = coerceContexts(
            data as Record<string, Record<string, any>>
          );
          (aggregator as ReturnType<typeof exampleContexts>).push(contexts);
        });
      },

      massageData: (dataSent: unknown) => {
        return (dataSent as TelemetryEvents).events.flatMap((event) => {
          return event.exampleContexts?.examples.map((example) => {
            const result: Record<string, any> = {};

            example.contextSet?.contexts.forEach((context) => {
              if (context.type === undefined) {
                throw new Error("context.type is undefined");
              }

              const type = context.type;

              Object.entries(context.values)
                .reverse()
                .forEach(([key, value]) => {
                  result[type] = result[type] ?? {};
                  result[type][key] = unwrapPrimitive(key, value).value;
                });
            });

            return result;
          });
        });
      },
    };
  },

  evaluationSummaries(data: TelemetryTest["data"]) {
    const { keys } = data[0] as { keys: string[] };
    return {
      exercise: (_: unknown, prefab: Prefab) => {
        keys.forEach((key: unknown) => {
          prefab.get(key as string);
        });
      },
      massageData: (dataSent: unknown) => {
        const summaries = (dataSent as TelemetryEvents).events[0]?.summaries
          ?.summaries;

        if (summaries === undefined) {
          throw new Error("summaries is undefined");
        }

        return summaries.flatMap((summary) => {
          return summary.counters.flatMap((counter) => {
            let valueType = Object.keys(
              counter.selectedValue as Record<string, unknown>
            )[0];

            if (valueType === "stringList") {
              valueType = "string_list";
            }

            const massagedSummary: Record<string, any> = {
              config_row_index: counter.configRowIndex,
              conditional_value_index: counter.conditionalValueIndex,
            };

            if (counter.weightedValueIndex !== undefined) {
              massagedSummary["weighted_value_index"] =
                counter.weightedValueIndex;
            }

            return {
              key: summary.key,
              type: typeLookup[summary.type],
              value: Object.values(
                counter.selectedValue as Record<string, unknown>
              )[0],
              value_type: valueType,
              count: counter.count.toNumber(),
              summary: massagedSummary,
            };
          });
        });
      },
    };
  },

  knownLoggers(
    testData: Array<{
      logger_name: string;
      counts: Record<string, number>;
    }>
  ) {
    return {
      exercise: (aggregator: unknown) => {
        if (testData === undefined) {
          throw new Error("data is undefined");
        }

        // eslint-disable-next-line @typescript-eslint/naming-convention
        testData.forEach(({ logger_name, counts }) => {
          Object.keys(counts).forEach((severityWord: string) => {
            const nonPluralSeverityWord = severityWord.replace(
              /s$/,
              ""
            ) as ValidLogLevelName;

            const count = counts[severityWord];

            if (count === undefined) {
              throw new Error(`Unknown count for ${severityWord}`);
            }

            for (let i = 0; i < count; i++) {
              const severity = wordLevelToNumber(nonPluralSeverityWord);

              if (severity === undefined) {
                throw new Error(`Unknown severity ${severityWord}`);
              }

              (aggregator as ReturnType<typeof knownLoggers>).push(
                logger_name,
                severity
              );
            }
          });
        });
      },

      massageData: (dataSent: unknown) => {
        return (dataSent as Loggers).loggers.map((logger: Logger) => {
          const counts: Record<string, any> = {};
          const levels: LoggerLevelName[] = [
            "debugs",
            "infos",
            "warns",
            "errors",
            "fatals",
          ];

          levels.forEach((severity) => {
            const recordedSeverity: Long | undefined = logger[severity];

            if (recordedSeverity != null) {
              counts[severity] = recordedSeverity.toNumber();
            }
          });

          return {
            logger_name: logger.loggerName,
            counts,
          };
        });
      },
    };
  },
};

export const tests = (): {
  inputOutputTests: InputOutputTest[];
  telemetryTests: TelemetryTest[];
} => {
  const testSuites: RawTestSuite[] = [];

  fs.readdirSync(testsPath).forEach((file) => {
    if (file.endsWith(".yaml")) {
      testSuites.push(...testsFromYAML(file));
    }
  });

  const telemetryTests: TelemetryTest[] = [];
  const inputOutputTests: InputOutputTest[] = [];

  testSuites.forEach((testSuite) => {
    testSuite.cases.forEach((testCase) => {
      const name = [testSuite.fileName, testSuite.name, testCase.name]
        .filter((name) => name !== undefined)
        .join(" - ");

      if (testCase.function === "post") {
        const aggregator = aggregatorLookup[testCase.aggregator];

        if (aggregator === undefined) {
          throw new Error(
            `Unknown aggregator type ${testCase.aggregator} in ${name}`
          );
        }

        const data = Array.isArray(testCase.data)
          ? testCase.data
          : [testCase.data];

        Object.keys(testCase.client_overrides ?? {}).forEach((key) => {
          if (!HANDLED_CLIENT_OVERRIDES_FOR_TELEMETRY_TESTS.includes(key)) {
            throw new Error(`Unhandled client override ${key} in ${name}`);
          }
        });

        const expectedData = Array.isArray(testCase.expected_data)
          ? testCase.expected_data
          : [testCase.expected_data];

        telemetryTests.push({
          name,
          function: testCase.function,
          data,
          type: testCase.type,
          expectedTelemetryData: expectedData,
          customOptions:
            testCase.client_overrides?.context_upload_mode === ":shape_only"
              ? {
                  contextUploadMode: "shapeOnly" as const,
                }
              : {},
          aggregator,
          ...aggregatorSpecificLogic[aggregator](data),
        });

        return;
      }

      const parentContext = contextMaybe(testSuite.context);

      const context = contextMaybe(testCase.input.context);

      const key = testCase.input.key ?? testCase.input.flag ?? "";

      const expectedValue = calcExpectedValue(testCase, key);

      const expectedWarning =
        expectedWarnings[
          Object.keys(expectedWarnings).find((str: string) =>
            name.includes(str)
          ) ?? ""
        ];

      Object.keys(testCase.client_overrides ?? {}).forEach((key) => {
        if (
          !HANDLED_CLIENT_OVERRIDES_FOR_INPUT_OUTPUT_TESTS.includes(key) &&
          !IGNORED_CLIENT_OVERRIDES_FOR_INPUT_OUTPUT_TESTS.includes(key)
        ) {
          throw new Error(`Unhandled client override ${key} in ${name}`);
        }
      });

      inputOutputTests.push({
        name,
        parentContext,
        context,
        expectedWarning,
        client: testCase.client,
        function: testCase.function,
        input: { ...testCase.input, key },
        expected: { ...testCase.expected, value: expectedValue },
        client_overrides: testCase.client_overrides,
      });
    });
  });

  return {
    telemetryTests,
    inputOutputTests,
  };
};
