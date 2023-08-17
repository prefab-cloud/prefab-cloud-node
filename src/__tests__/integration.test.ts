import { Prefab } from "../prefab";
import type { PrefabInterface } from "../prefab";
import type { GetValue } from "../unwrap";
import { tests } from "./integrationHelper";
import type { InputOutputTest } from "./integrationHelper";

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
    if (
      test.name.includes("log aggregation") ||
      test.name.includes("context shape aggregation") ||
      test.name.includes("example contexts")
    ) {
      it(test.name, async () => {
        const apiUrl = "https://api.staging-prefab.cloud";

        const options: ConstructorParameters<typeof Prefab>[0] = {
          apiKey,
          apiUrl,
          cdnUrl,
          ...test.customOptions,
        };

        const prefab = new Prefab(options);

        await prefab.init();

        if (test.aggregator === "evaluationSummary") {
          throw new Error("evaluationSummary is not implemented yet");
        }

        const aggregator = prefab.telemetry[test.aggregator];

        if (!aggregator.enabled) {
          throw new Error(`Aggregator ${test.aggregator} is not enabled`);
        }

        test.exercise(aggregator);

        const result = await aggregator.sync();

        if (result == null) {
          throw new Error(
            "Result was unexpectedly void. Maybe `data.size === 0`?"
          );
        }

        expect(result.status).toBe(200);

        const actualData = test.massageData(result.dataSent);

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
