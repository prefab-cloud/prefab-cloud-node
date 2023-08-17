import type Long from "long";
import type { Prefab } from "../prefab";
import { wordLevelToNumber } from "../prefab";
import type { Context, Contexts, ContextValue } from "../types";
import type { ContextShapes, Logger, Loggers, TelemetryEvents } from "../proto";
import type { knownLoggers, LoggerLevelName } from "../telemetry/knownLoggers";
import type { contextShapes } from "../telemetry/contextShapes";
import type { exampleContexts } from "../telemetry/exampleContexts";
import fs from "fs";
import { PREFIX } from "../logger";

const YAML = require("yaml");

const testDataPath = `./prefab-cloud-integration-test-data`;

const version = fs.readFileSync(`${testDataPath}/version`).toString().trim();

const testsPath = `${testDataPath}/tests/${version}`;

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
  };
  client_overrides: {
    namespace?: string;
    on_no_default?: 2;
  };
}

interface RawTelemetryTestCase {
  name: string;
  client: string;
  function: "post";
  data: Record<string, any> | Array<Record<string, any>> | string[];
  expected_data: Record<string, any>;
  aggregator: RawAggregator;
  client_overrides: {
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
  };
}

export interface TelemetryTest {
  name: string;
  data: Array<Record<string, any>> | string[];
  function: "post";
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

              result[context.type] = Object.entries(context.values)
                .reverse()
                .map(([key, value]) => {
                  return {
                    key,
                    value: Object.values(value)[0],
                    value_type: Object.keys(value)[0],
                  };
                });
            });

            return result;
          });
        });
      },
    };
  },

  evaluationSummaries(data: TelemetryTest["data"]) {
    return {
      exercise: (_: unknown, prefab: Prefab) => {
        data.forEach((key: unknown) => {
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

            return {
              key: summary.key,
              type: typeLookup[summary.type],
              value: Object.values(
                counter.selectedValue as Record<string, unknown>
              )[0],
              value_type: valueType,
              count: counter.count.toNumber(),
              summary: {
                config_row_index: counter.configRowIndex,
                conditional_value_index: counter.conditionalValueIndex,
              },
            };
          });
        });
      },
    };
  },

  knownLoggers(testData: Record<string, any>) {
    return {
      exercise: (aggregator: unknown) => {
        const severityTranslator = [
          wordLevelToNumber("debug"),
          wordLevelToNumber("info"),
          wordLevelToNumber("warn"),
          wordLevelToNumber("error"),
          wordLevelToNumber("fatal"),
        ];

        // There's only one Record
        const data = testData[0];

        if (data === undefined) {
          throw new Error("data is undefined");
        }

        Object.keys(data).forEach((loggerName) => {
          data[loggerName].forEach((count: number, severityIndex: number) => {
            for (let i = 0; i < count; i++) {
              const severity = severityTranslator[severityIndex];

              if (severity === undefined) {
                throw new Error(
                  `Invalid severity index: ${severityIndex} for ${loggerName}`
                );
              }

              (aggregator as ReturnType<typeof knownLoggers>).push(
                loggerName,
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

        telemetryTests.push({
          name,
          function: testCase.function,
          data,
          expectedTelemetryData: testCase.expected_data,
          customOptions:
            testCase.client_overrides.context_upload_mode === ":shape_only"
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
