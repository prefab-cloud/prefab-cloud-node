import { Prefab } from "../prefab";
import type { PrefabInterface } from "../prefab";
import type { GetValue } from "../unwrap";
import { tests } from "./integrationHelper";
import type { Test } from "./integrationHelper";

const func = (prefab: PrefabInterface, test: Test): any => {
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
  tests().forEach((test) => {
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

      const prefab = new Prefab(options);

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
});
