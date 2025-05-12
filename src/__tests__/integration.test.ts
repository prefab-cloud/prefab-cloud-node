import { Prefab } from "../prefab";
import type { PrefabInterface } from "../prefab";
import type { ResolverAPI } from "../resolver";
import type { GetValue } from "../unwrap";
import { tests } from "./integrationHelper";
import type { InputOutputTest } from "./integrationHelper";

const func = (
  client: PrefabInterface | ResolverAPI,
  test: InputOutputTest
): any => {
  switch (test.function) {
    case "get":
      return client.get.bind(client);
    case "get_or_raise":
      return client.get.bind(client);
    case "enabled":
      return client.isFeatureEnabled.bind(client);
    default:
      throw new Error(`Unknown function: ${test.function}`);
  }
};

const apiKey = process.env["PREFAB_INTEGRATION_TEST_API_KEY"];

if (apiKey === undefined || apiKey.length === 0) {
  throw new Error("PREFAB_INTEGRATION_TEST_API_KEY is not set");
}

const SKIPPED = [
  // Init timeout isn't implemented yet
  "get_or_raise.yaml - get_or_raise can raise an error if the client does not initialize in time",
];

const defaultOptions = {
  collectLoggerCounts: false,
  contextUploadMode: "none" as const,
  collectEvaluationSummaries: false,
  sources: [
    "https://belt.staging-prefab.cloud",
    "https://suspenders.staging-prefab.cloud",
  ],
};

let prefab: Prefab;

afterEach(() => {
  if (prefab !== undefined && prefab !== null) {
    prefab.close();
  }
});

describe("integration tests", () => {
  const { inputOutputTests, telemetryTests } = tests();

  inputOutputTests.forEach((test) => {
    if (SKIPPED.includes(test.name)) {
      it.skip(test.name, () => {});
      return;
    }

    it(test.name, async () => {
      if (test.expectedWarning !== undefined) {
        jest.spyOn(console, "warn").mockImplementation();
      }

      const options: ConstructorParameters<typeof Prefab>[0] = {
        ...defaultOptions,
        apiKey,
        contextUploadMode: "none",
        globalContext: test.contexts.global,
      };

      if (test.client_overrides?.on_no_default === 2) {
        options.onNoDefault = "ignore";
      }

      prefab = new Prefab({ ...options, collectLoggerCounts: false });

      await prefab.init();

      const evaluate = (): GetValue => {
        if (test.contexts.block !== undefined) {
          let returnValue: GetValue | "returnValue was never set";

          prefab.inContext(test.contexts.block, (prefabWithContext) => {
            returnValue = func(prefabWithContext, test)(
              test.input.key,
              test.contexts.local,
              test.input.default
            );
          });

          return returnValue;
        } else {
          return func(prefab, test)(
            test.input.key,
            test.contexts.local,
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
    it(test.name, async () => {
      const options: ConstructorParameters<typeof Prefab>[0] = {
        apiKey,
        sources: [
          "https://belt.staging-prefab.cloud",
          "https://suspenders.staging-prefab.cloud",
        ],
        ...test.customOptions,
      };

      const prefab = new Prefab(options);

      await prefab.init();

      const aggregator = prefab.telemetry[test.aggregator];

      if (!aggregator.enabled) {
        throw new Error(`Aggregator ${test.aggregator} is not enabled`);
      }

      test.exercise(aggregator, prefab);

      const result = await aggregator.sync();

      if (Object.keys(test.expectedTelemetryData).length === 0) {
        expect(result).toBeUndefined();
        return;
      }

      if (result == null) {
        if (
          test.expectedTelemetryData !== null &&
          JSON.stringify(test.expectedTelemetryData) !== "[null]"
        ) {
          throw new Error(
            "Result was unexpectedly void. Maybe `data.size === 0`?"
          );
        }
        return;
      }

      expect(result.status).toBe(200);

      const actualData = test.massageData(result.dataSent);

      if (Array.isArray(actualData)) {
        expect(actualData.length).toBe(
          (test.expectedTelemetryData as unknown[]).length
        );

        (test.expectedTelemetryData as any[]).forEach((expected) => {
          expect(actualData).toContainEqual(expected);
        });
      } else {
        expect(actualData).toStrictEqual(test.expectedTelemetryData);
      }

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
  });
});
