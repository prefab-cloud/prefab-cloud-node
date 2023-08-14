import type Long from "long";
import { Prefab, wordLevelToNumber } from "../prefab";
import type { PrefabInterface } from "../prefab";
import type { GetValue } from "../unwrap";
import { tests } from "./integrationHelper";
import type { InputOutputTest } from "./integrationHelper";
import type { Logger } from "../proto";
import { type LoggerLevelName } from "../telemetry/knownLoggers";

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
    if (test.name.includes("log aggregation")) {
      it(test.name, async () => {
        const apiUrl = "https://api.staging-prefab.cloud";

        const options: ConstructorParameters<typeof Prefab>[0] = {
          apiKey,
          apiUrl,
          cdnUrl,
        };

        const prefab = new Prefab(options);

        await prefab.init();

        const aggregator = prefab.telemetry[test.aggregator];

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

                aggregator.push(loggerName, severity);
              }
            }
          );
        });

        const result = await aggregator.sync();

        if (result == null) {
          throw new Error("Result was unexpectedly void");
        }

        expect(result.status).toBe(200);

        const actualData = result.dataSent.loggers.map((logger: Logger) => {
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

        expect(actualData).toStrictEqual(test.expectedTelemetryData);

        expect(aggregator.data).toStrictEqual({});

        expect(aggregator.timeout).toBeDefined();
        clearTimeout(aggregator.timeout);
      });
    } else {
      it.skip(test.name, async () => {});
    }
  });
});
