import type Long from "long";
import { Prefab, wordLevelToNumber } from "../prefab";
import type { PrefabInterface } from "../prefab";
import type { Context, Contexts, ContextValue } from "../types";
import type { GetValue } from "../unwrap";
import { tests } from "./integrationHelper";
import type { InputOutputTest, TelemetryTest } from "./integrationHelper";
import type { ContextShapes, Logger, Loggers, TelemetryEvents } from "../proto";
import type { knownLoggers, LoggerLevelName } from "../telemetry/knownLoggers";
import type { contextShapes } from "../telemetry/contextShapes";
import type { exampleContexts } from "../telemetry/exampleContexts";

const func = (prefab: PrefabInterface, test: InputOutputTest): any => {
  switch (test.function) {
    case "get":
      return prefab.get.bind(prefab);
    case "get_or_raise":
      return prefab.get.bind(prefab);
    case "enabled":
      return prefab.isFeatureEnabled.bind(prefab);
    default:
      throw new Error(`Unknown function: ${test.function}`);
  }
};

const apiKey = process.env["PREFAB_INTEGRATION_TEST_API_KEY"];
const cdnUrl = "https://api-staging-prefab-cloud.global.ssl.fastly.net";

if (apiKey === undefined || apiKey.length === 0) {
  throw new Error("PREFAB_INTEGRATION_TEST_API_KEY is not set");
}

describe("integration tests", () => {
  const { inputOutputTests, telemetryTests } = tests();

  inputOutputTests.forEach((test) => {
    it(test.name, async () => {
      if (test.expectedWarning !== undefined) {
        jest.spyOn(console, "warn").mockImplementation();
      }

      const options: ConstructorParameters<typeof Prefab>[0] = {
        apiKey,
        cdnUrl,
        namespace: test.client_overrides?.namespace,
        contextUploadMode: "none",
      };

      if (test.client_overrides?.on_no_default === 2) {
        options.onNoDefault = "ignore";
      }

      const prefab = new Prefab({ ...options, collectLoggerCounts: false });

      await prefab.init();

      const evaluate = (): GetValue => {
        if (test.parentContext !== undefined) {
          let returnValue: GetValue | "returnValue was never set";

          prefab.inContext(test.parentContext, (prefabWithContext) => {
            returnValue = func(prefabWithContext, test)(
              test.input.key,
              test.context,
              test.input.default
            );
          });

          return returnValue;
        } else {
          return func(prefab, test)(
            test.input.key,
            test.context,
            test.input.default
          );
        }
      };

      if (test.expected.status === "raise") {
        expect(evaluate).toThrow(test.expected.message);
      } else {
        const actual = evaluate();

        expect(actual).toEqual(test.expected.value);
      }

      if (test.expectedWarning !== undefined) {
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringMatching(test.expectedWarning)
        );
      }
    });
  });

  telemetryTests.forEach((test) => {
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
      contextShapes(test: TelemetryTest) {
        return {
          customOptions: {
            contextUploadMode: "shapeOnly" as const,
          },

          exercise: (aggregator: unknown) => {
            test.data.forEach((data: Record<string, Record<string, any>>) => {
              const contexts = coerceContexts(data);

              (aggregator as ReturnType<typeof contextShapes>).push(contexts);
            });
          },

          massageData: (dataSent: ContextShapes) => {
            return dataSent.shapes.map(({ name, fieldTypes }) => {
              return {
                name,
                field_types: fieldTypes,
              };
            });
          },
        };
      },

      exampleContexts(test: TelemetryTest) {
        return {
          customOptions: {},

          exercise: (aggregator: unknown) => {
            test.data.forEach((data: Record<string, Record<string, any>>) => {
              const contexts = coerceContexts(data);
              (aggregator as ReturnType<typeof exampleContexts>).push(contexts);
            });
          },

          massageData: (dataSent: TelemetryEvents) => {
            return dataSent.events.flatMap((event) => {
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

      evaluationSummary(test: TelemetryTest) {
        console.log(test);
        return {
          customOptions: {},
          exercise: (_: unknown) => {},
          massageData: (_: unknown) => {},
        };
      },

      knownLoggers(test: TelemetryTest) {
        return {
          customOptions: {},

          exercise: (aggregator: unknown) => {
            const severityTranslator = [
              wordLevelToNumber("debug"),
              wordLevelToNumber("info"),
              wordLevelToNumber("warn"),
              wordLevelToNumber("error"),
              wordLevelToNumber("fatal"),
            ];

            // There's only one Record
            const data = test.data[0];

            if (data === undefined) {
              throw new Error("data is undefined");
            }

            Object.keys(data).forEach((loggerName) => {
              data[loggerName].forEach(
                (count: number, severityIndex: number) => {
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
                }
              );
            });
          },

          massageData: (dataSent: Loggers) => {
            return dataSent.loggers.map((logger: Logger) => {
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

    if (
      test.name.includes("log aggregation") ||
      test.name.includes("context shape aggregation") ||
      test.name.includes("example contexts")
    ) {
      it(test.name, async () => {
        const apiUrl = "https://api.staging-prefab.cloud";

        const { customOptions, exercise, massageData } =
          aggregatorSpecificLogic[test.aggregator](test);

        const options: ConstructorParameters<typeof Prefab>[0] = {
          apiKey,
          apiUrl,
          cdnUrl,
          ...customOptions,
        };

        const prefab = new Prefab(options);

        await prefab.init();

        if (test.aggregator === "evaluationSummary") {
          throw new Error("evaluationSummary is not implemented yet");
        }

        const aggregator = prefab.telemetry[test.aggregator];

        exercise(aggregator);

        const result = await aggregator.sync();

        if (result == null) {
          throw new Error(
            "Result was unexpectedly void. Maybe `data.size === 0`?"
          );
        }

        expect(result.status).toBe(200);

        const actualData = massageData(result.dataSent);

        expect(actualData).toStrictEqual(test.expectedTelemetryData);

        if (aggregator.data instanceof Map) {
          expect(aggregator.data.size).toBe(0);
        } else if (aggregator.data instanceof Array) {
          expect(aggregator.data.length).toBe(0);
        } else {
          expect(aggregator.data).toStrictEqual({});
        }

        expect(aggregator.timeout).toBeDefined();

        Object.values(prefab.telemetry).forEach((aggregator) => {
          clearTimeout(aggregator.timeout);
        });
      });
    } else {
      it.skip(test.name, async () => {});
    }
  });
});
