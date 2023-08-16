import type Long from "long";
import { Prefab, wordLevelToNumber } from "../prefab";
import type { PrefabInterface } from "../prefab";
import type { Context, Contexts, ContextValue } from "../types";
import type { GetValue } from "../unwrap";
import { tests } from "./integrationHelper";
import type { InputOutputTest, TelemetryTest } from "./integrationHelper";
import type { ContextShapes, Logger, Loggers } from "../proto";
import type { knownLoggers, LoggerLevelName } from "../telemetry/knownLoggers";
import type { contextShapes } from "../telemetry/contextShapes";

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
    const aggregatorSpecificLogic = {
      contextShapes(test: TelemetryTest) {
        return {
          customOptions: {
            contextUploadMode: "shapeOnly" as const,
          },

          exercise: (aggregator: unknown) => {
            const contexts: Contexts = new Map();

            Object.keys(test.data).forEach((contextName) => {
              const context: Context = new Map<string, ContextValue>(
                Object.entries(test.data[contextName])
              );

              contexts.set(contextName, context);
            });

            (aggregator as ReturnType<typeof contextShapes>).push(contexts);
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

            Object.keys(test.data).forEach((loggerName) => {
              test.data[loggerName].forEach(
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
      test.name.includes("context shape aggregation")
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
