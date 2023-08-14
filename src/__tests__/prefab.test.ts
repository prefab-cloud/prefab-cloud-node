import basicConfig from "./fixtures/basicConfig";
import basicFlag from "./fixtures/basicFlag";
import rolloutFlag from "./fixtures/rolloutFlag";
import envConfig from "./fixtures/envConfig";
import namespaceConfig from "./fixtures/namespaceConfig";
import propIsOneOf from "./fixtures/propIsOneOf";
import propIsOneOfAndEndsWith from "./fixtures/propIsOneOfAndEndsWith";
import { Prefab } from "../prefab";
import type { Contexts } from "../types";
import { LogLevel } from "../proto";

import {
  nTimes,
  irrelevant,
  projectEnvIdUnderTest,
  levelAt,
} from "./testHelpers";

const configs = [
  basicConfig,
  basicFlag,
  envConfig,
  namespaceConfig,
  propIsOneOf,
  propIsOneOfAndEndsWith,
  rolloutFlag,
];

afterEach(() => {
  jest.restoreAllMocks();
});

describe("prefab", () => {
  describe("init", () => {
    const invalidApiKey = "this won't work";
    const validApiKey = process.env["PREFAB_TEST_API_KEY"];

    it("should be able to parse config from the CDN", async () => {
      if (validApiKey === undefined) {
        throw new Error(
          "You must set the PREFAB_TEST_API_KEY environment variable to run this test."
        );
      }

      const prefab = new Prefab({
        apiKey: validApiKey,
        collectLoggerCounts: false,
      });
      await prefab.init();

      expect(prefab.get("abc")).toEqual(true);
    });

    it("throws a 401 if you have an invalid API key", async () => {
      const prefab = new Prefab({ apiKey: invalidApiKey });

      jest.spyOn(console, "warn").mockImplementation();

      await expect(prefab.init()).rejects.toThrow(
        "Unauthorized. Check your Prefab SDK API key."
      );

      expect(console.warn).toHaveBeenCalled();
    });
  });

  // While the evaluation logic is best tested in evaluate.test.ts,
  // these serve as more integration-like tests for happy paths.
  describe("get", () => {
    describe("when the key cannot be found", () => {
      it("throws if no default is provided and onNoDefault is `error`", () => {
        const prefab = new Prefab({ apiKey: irrelevant });
        prefab.setConfig([], projectEnvIdUnderTest);

        expect(() => {
          prefab.get("missing.value");
        }).toThrow("No value found for key 'missing.value'");
      });

      it("warns if no default is provided and onNoDefault is `warn`", () => {
        const prefab = new Prefab({ apiKey: irrelevant, onNoDefault: "warn" });
        prefab.setConfig([], projectEnvIdUnderTest);

        jest.spyOn(console, "warn").mockImplementation();

        expect(prefab.get("missing.value")).toBeUndefined();

        expect(console.warn).toHaveBeenCalledWith(
          "No value found for key 'missing.value'"
        );
      });

      it("returns undefined if no default is provided and onNoDefault is `ignore`", () => {
        const prefab = new Prefab({ apiKey: irrelevant, onNoDefault: "warn" });
        prefab.setConfig([], projectEnvIdUnderTest);

        jest.spyOn(console, "warn").mockImplementation();

        expect(prefab.get("missing.value")).toBeUndefined();
      });

      it("returns the default if one is provided", () => {
        const prefab = new Prefab({ apiKey: irrelevant, onNoDefault: "warn" });
        prefab.setConfig([], projectEnvIdUnderTest);

        const defaultValue = "default-value";

        expect(prefab.get("missing.value", new Map(), defaultValue)).toEqual(
          defaultValue
        );
      });
    });

    it("returns a config value with no rules", () => {
      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig(configs, projectEnvIdUnderTest);
      expect(prefab.get("basic.value")).toEqual(42);
    });

    it("returns a config value with no rules but an environment", () => {
      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig(configs, projectEnvIdUnderTest);
      expect(prefab.get("basic.env")).toEqual(["a", "b", "c", "d"]);
    });

    it("returns a config value for a namespace", () => {
      const prefabNs1 = new Prefab({
        apiKey: irrelevant,
        namespace: "my-namespace",
      });
      prefabNs1.setConfig(configs, projectEnvIdUnderTest);
      expect(prefabNs1.get("basic.namespace")).toEqual(["in-namespace"]);

      const prefabNs2 = new Prefab({
        apiKey: irrelevant,
        namespace: "incorrect-namespace",
      });
      prefabNs2.setConfig(configs, projectEnvIdUnderTest);
      expect(prefabNs2.get("basic.namespace")).toEqual(["not-in-namespace"]);

      const prefabNsMissing = new Prefab({
        apiKey: irrelevant,
      });
      prefabNsMissing.setConfig(configs, projectEnvIdUnderTest);
      expect(prefabNsMissing.get("basic.namespace")).toEqual([
        "not-in-namespace",
      ]);
    });

    it("returns a config value for a PROP_IS_ONE_OF match", () => {
      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig(configs, projectEnvIdUnderTest);

      expect(prefab.get("prop.is.one.of")).toEqual("default");

      expect(
        prefab.get(
          "prop.is.one.of",
          new Map([["user", new Map([["country", "US"]])]])
        )
      ).toEqual("correct");
    });

    it("returns a config value for a PROP_IS_ONE_OF and PROP_ENDS_WITH_ONE_OF match", () => {
      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig(configs, projectEnvIdUnderTest);

      expect(prefab.get("prop.is.one.of.and.ends.with")).toEqual("default");

      expect(
        prefab.get(
          "prop.is.one.of.and.ends.with",
          new Map([
            [
              "user",
              new Map([
                ["country", "US"],
                ["email", "test@prefab.cloud"],
              ]),
            ],
          ])
        )
      ).toEqual("correct");
    });
  });

  describe("isFeatureEnabled", () => {
    describe("when the key cannot be found", () => {
      it("throws if no default is provided and onNoDefault is `error`", () => {
        const prefab = new Prefab({ apiKey: irrelevant });
        prefab.setConfig([], projectEnvIdUnderTest);

        expect(() => {
          prefab.isFeatureEnabled("missing.value");
        }).toThrow("No value found for key 'missing.value'");
      });

      it("returns false and warns if onNoDefault is `warn`", () => {
        const prefab = new Prefab({ apiKey: irrelevant, onNoDefault: "warn" });
        prefab.setConfig([], projectEnvIdUnderTest);

        jest.spyOn(console, "warn").mockImplementation();

        expect(prefab.isFeatureEnabled("missing.value")).toEqual(false);

        expect(console.warn).toHaveBeenCalledWith(
          "No value found for key 'missing.value'"
        );
      });

      it("returns false if onNoDefault is `ignore`", () => {
        const prefab = new Prefab({ apiKey: irrelevant, onNoDefault: "warn" });
        prefab.setConfig([], projectEnvIdUnderTest);

        jest.spyOn(console, "warn").mockImplementation();

        expect(prefab.isFeatureEnabled("missing.value")).toEqual(false);
      });
    });

    it("returns true when the flag matches", () => {
      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig(configs, projectEnvIdUnderTest);
      expect(prefab.isFeatureEnabled("basic.flag")).toEqual(true);
    });

    it("returns a random value for a weighted flag with no context", () => {
      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig(configs, projectEnvIdUnderTest);

      const results: Record<string, number> = { true: 0, false: 0 };

      nTimes(100, () => {
        results[prefab.isFeatureEnabled("rollout.flag").toString()]++;
      });

      // The flag has a 10% chance of being true and a 90% chance of being false
      // We'll allow a margin of error.
      expect(results["true"]).toBeLessThan(30);
      expect(results["false"]).toBeGreaterThan(70);
    });

    it("returns a consistent value for a weighted flag with context", () => {
      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig(configs, projectEnvIdUnderTest);

      const context = (trackingId: string): Contexts =>
        new Map([["user", new Map([["trackingId", trackingId]])]]);

      nTimes(100, () => {
        expect(prefab.isFeatureEnabled("rollout.flag", context("100"))).toEqual(
          false
        );
      });

      nTimes(100, () => {
        expect(prefab.isFeatureEnabled("rollout.flag", context("120"))).toEqual(
          true
        );
      });
    });
  });

  describe("shouldLog", () => {
    it("returns true if the resolved level is greater than or equal to the desired level", () => {
      const loggerName = "a.b.c.d";

      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig([levelAt(loggerName, "info")], projectEnvIdUnderTest);

      expect(
        prefab.shouldLog({
          loggerName,
          desiredLevel: "error",
        })
      ).toEqual(true);

      expect(prefab.telemetry.knownLoggers.data).toStrictEqual({
        [loggerName]: {
          [LogLevel.ERROR]: 1,
        },
      });
    });

    it("returns false if the resolved level is lower than the desired level", () => {
      const loggerName = "a.b.c.d";

      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig([levelAt(loggerName, "info")], projectEnvIdUnderTest);

      expect(
        prefab.shouldLog({
          loggerName,
          desiredLevel: "debug",
        })
      ).toEqual(false);

      expect(prefab.telemetry.knownLoggers.data).toStrictEqual({
        [loggerName]: {
          [LogLevel.DEBUG]: 1,
        },
      });
    });

    it("returns true if the desired level is invalid", () => {
      jest.spyOn(console, "warn").mockImplementation();
      const loggerName = "a.b.c.d";

      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig([levelAt(loggerName, "trace")], projectEnvIdUnderTest);

      expect(
        prefab.shouldLog({
          loggerName,
          desiredLevel: "invalid" as any,
        })
      ).toEqual(true);

      expect(console.warn).toHaveBeenCalledWith(
        "[prefab]: Invalid desiredLevel `invalid` provided to shouldLog. Returning `true`"
      );

      expect(prefab.telemetry.knownLoggers.data).toStrictEqual({});
    });

    it("returns the default level provided if there is no match", () => {
      jest.spyOn(console, "warn").mockImplementation();

      const loggerName = "a.b.c.d";

      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig([], projectEnvIdUnderTest);

      expect(
        prefab.shouldLog({
          loggerName,
          desiredLevel: LogLevel.DEBUG,
          defaultLevel: LogLevel.TRACE,
        })
      ).toEqual(true);

      expect(
        prefab.shouldLog({
          loggerName,
          desiredLevel: LogLevel.DEBUG,
          defaultLevel: LogLevel.DEBUG,
        })
      ).toEqual(true);

      expect(
        prefab.shouldLog({
          loggerName,
          desiredLevel: LogLevel.DEBUG,
          defaultLevel: LogLevel.INFO,
        })
      ).toEqual(false);

      expect(console.warn).not.toHaveBeenCalled();

      expect(prefab.telemetry.knownLoggers.data).toStrictEqual({
        [loggerName]: {
          [LogLevel.DEBUG]: 3,
        },
      });
    });

    it("returns the default level provided if the resolver hasn't finalized", () => {
      const mockConsoleWarn = jest.spyOn(console, "warn").mockImplementation();
      const loggerName = "a.b.c.d";

      const prefab = new Prefab({ apiKey: irrelevant });

      expect(
        prefab.shouldLog({
          loggerName,
          desiredLevel: LogLevel.DEBUG,
          defaultLevel: LogLevel.TRACE,
        })
      ).toEqual(true);

      expect(
        prefab.shouldLog({
          loggerName,
          desiredLevel: LogLevel.DEBUG,
          defaultLevel: LogLevel.DEBUG,
        })
      ).toEqual(true);

      expect(
        prefab.shouldLog({
          loggerName,
          desiredLevel: LogLevel.DEBUG,
          defaultLevel: LogLevel.INFO,
        })
      ).toEqual(false);

      expect(mockConsoleWarn.mock.calls).toEqual([
        [
          "[prefab] Still initializing... Comparing against defaultLogLevel setting: 5",
        ],
        [
          "[prefab] Still initializing... Comparing against defaultLogLevel setting: 5",
        ],
        [
          "[prefab] Still initializing... Comparing against defaultLogLevel setting: 5",
        ],
      ]);

      expect(prefab.telemetry.knownLoggers.data).toStrictEqual({
        [loggerName]: {
          [LogLevel.DEBUG]: 3,
        },
      });
    });

    it("does not collect telemetry if collectLoggerCounts=false", () => {
      const loggerName = "a.b.c.d";

      const prefab = new Prefab({
        apiKey: irrelevant,
        collectLoggerCounts: false,
      });
      prefab.setConfig([levelAt(loggerName, "info")], projectEnvIdUnderTest);

      expect(
        prefab.shouldLog({
          loggerName,
          desiredLevel: "error",
        })
      ).toEqual(true);

      expect(prefab.telemetry.knownLoggers.data).toStrictEqual({});
    });
  });
});
