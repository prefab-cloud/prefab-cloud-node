import fs from "fs";
import YAML from "yaml";
import { Prefab } from "../prefab";
import type { PrefabInterface } from "../prefab";
import type { Contexts } from "../types";
import type { GetValue } from "../unwrap";

const expectedWarnings: Record<string, RegExp> = {
  "always returns false for a non-boolean flag":
    /Non-boolean FF's return `false` for isFeatureEnabled checks./,
};

interface TestSuite {
  name: string;
  context: Record<string, Record<string, any>> | undefined;
  cases: TestCase[];
}

interface TestCase {
  name: string;
  client: string;
  function: string;
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
    namespace: string | undefined;
    on_no_default: 2 | undefined;
  };
}

const testsFromYAML = (filePath: string): TestSuite[] => {
  return YAML.parse(
    fs.readFileSync(
      `../prefab-cloud-integration-test-data/tests/0.2.0/${filePath}`,
      "utf8"
    )
  ).tests;
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

const func = (prefab: PrefabInterface, testCase: TestCase): any => {
  switch (testCase.function) {
    case "get":
      return prefab.get.bind(prefab);
    case "get_or_raise":
      return prefab.get.bind(prefab);
    case "enabled":
      return prefab.isFeatureEnabled.bind(prefab);
    default:
      throw new Error(`Unknown function: ${testCase.function}`);
  }
};

const apiKey = process.env["PREFAB_INTEGRATION_TEST_API_KEY"];
const cdnUrl = "https://api-staging-prefab-cloud.global.ssl.fastly.net";

const getTestSuite = testsFromYAML("get.yaml");
const enabledTestSuite = testsFromYAML("enabled.yaml");
const getFeatureFlagTestSuite = testsFromYAML("get_feature_flag.yaml");
const getOrRaiseSuite = testsFromYAML("get_or_raise.yaml");
const enabledWithContextsSuite = testsFromYAML("enabled_with_contexts.yaml");

describe("integration tests", () => {
  [
    ...getTestSuite,
    ...enabledTestSuite,
    ...getFeatureFlagTestSuite,
    ...getOrRaiseSuite,
    ...enabledWithContextsSuite,
  ].forEach((testSuite) => {
    testSuite.cases.forEach((testCase) => {
      const parentContext =
        testSuite.context !== undefined
          ? formatContext(testSuite.context)
          : undefined;

      it(testCase.name, async () => {
        if (apiKey === undefined || apiKey.length === 0) {
          throw new Error("PREFAB_INTEGRATION_TEST_API_KEY is not set");
        }

        if (Object.keys(expectedWarnings).includes(testCase.name)) {
          jest.spyOn(console, "warn").mockImplementation();
        }

        const options: ConstructorParameters<typeof Prefab>[0] = {
          apiKey,
          cdnUrl,
          namespace: testCase.client_overrides?.namespace,
        };

        if (testCase.client_overrides?.on_no_default === 2) {
          options.onNoDefault = "ignore";
        }

        const prefab = new Prefab(options);

        await prefab.init();

        const key = testCase.input.key ?? testCase.input.flag;

        if (key === undefined) {
          throw new Error("key is undefined");
        }

        const localContext =
          testCase.input.context !== undefined
            ? formatContext(testCase.input.context)
            : undefined;

        const evaluate = (): GetValue => {
          if (parentContext !== undefined) {
            let returnValue: GetValue | "returnValue was never set";

            prefab.inContext(parentContext, (prefabWithContext) => {
              returnValue = func(prefabWithContext, testCase)(
                key,
                localContext,
                testCase.input.default
              );
            });

            return returnValue;
          } else {
            return func(prefab, testCase)(
              key,
              localContext,
              testCase.input.default
            );
          }
        };

        if (testCase.expected.status === "raise") {
          expect(evaluate).toThrow(testCase.expected.message);
        } else {
          const actual = evaluate();

          expect(actual).toEqual(
            testCase.expected.value === null
              ? undefined
              : testCase.expected.value
          );
        }

        if (Object.keys(expectedWarnings).includes(testCase.name)) {
          expect(console.warn).toHaveBeenCalledWith(
            expect.stringMatching(expectedWarnings[testCase.name] as RegExp)
          );
        }
      });
    });
  });
});
