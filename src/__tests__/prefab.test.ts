import * as path from "path";

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
import type { Config } from "../proto";
import { encrypt, generateNewHexKey } from "../../src/encryption";
import secretConfig from "./fixtures/secretConfig";
import decryptionKeyConfig from "./fixtures/decryptionKeyConfig";

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

    it("can parse config from the CDN", async () => {
      if (validApiKey === undefined) {
        throw new Error(
          "You must set the PREFAB_TEST_API_KEY environment variable to run this test."
        );
      }

      const prefab = new Prefab({
        apiKey: validApiKey,
        collectLoggerCounts: false,
        contextUploadMode: "none",
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

    it("can get a provided value", async () => {
      if (validApiKey === undefined) {
        throw new Error(
          "You must set the PREFAB_TEST_API_KEY environment variable to run this test."
        );
      }

      process.env["MY_ENV_VAR"] = "EXAMPLE";

      const prefab = new Prefab({
        apiKey: validApiKey,
        collectLoggerCounts: false,
        contextUploadMode: "none",
      });

      await prefab.init();

      expect(prefab.get("basic.provided")).toEqual("EXAMPLE");
    });
  });

  // While the evaluation logic is best tested in evaluate.test.ts,
  // these serve as more integration-like tests for happy paths.
  describe("get", () => {
    describe("when the key cannot be found", () => {
      it("throws if no default is provided and onNoDefault is `error`", () => {
        const prefab = new Prefab({ apiKey: irrelevant });
        prefab.setConfig([], projectEnvIdUnderTest, new Map());

        expect(() => {
          prefab.get("missing.value");
        }).toThrow("No value found for key 'missing.value'");
      });

      it("warns if no default is provided and onNoDefault is `warn`", () => {
        const prefab = new Prefab({ apiKey: irrelevant, onNoDefault: "warn" });
        prefab.setConfig([], projectEnvIdUnderTest, new Map());

        jest.spyOn(console, "warn").mockImplementation();

        expect(prefab.get("missing.value")).toBeUndefined();

        expect(console.warn).toHaveBeenCalledWith(
          "No value found for key 'missing.value'"
        );
      });

      it("returns undefined if no default is provided and onNoDefault is `ignore`", () => {
        const prefab = new Prefab({ apiKey: irrelevant, onNoDefault: "warn" });
        prefab.setConfig([], projectEnvIdUnderTest, new Map());

        jest.spyOn(console, "warn").mockImplementation();

        expect(prefab.get("missing.value")).toBeUndefined();
      });

      it("returns the default if one is provided", () => {
        const prefab = new Prefab({ apiKey: irrelevant, onNoDefault: "warn" });
        prefab.setConfig([], projectEnvIdUnderTest, new Map());

        const defaultValue = "default-value";

        expect(prefab.get("missing.value", new Map(), defaultValue)).toEqual(
          defaultValue
        );
      });
    });

    it("returns a config value with no rules", () => {
      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig(configs, projectEnvIdUnderTest, new Map());
      expect(prefab.get("basic.value")).toEqual(42);
    });

    it("returns a config value with no rules but an environment", () => {
      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig(configs, projectEnvIdUnderTest, new Map());
      expect(prefab.get("basic.env")).toEqual(["a", "b", "c", "d"]);
    });

    it("returns a config value for a namespace", () => {
      const prefabNs1 = new Prefab({
        apiKey: irrelevant,
        namespace: "my-namespace",
      });
      prefabNs1.setConfig(configs, projectEnvIdUnderTest, new Map());
      expect(prefabNs1.get("basic.namespace")).toEqual(["in-namespace"]);

      const prefabNs2 = new Prefab({
        apiKey: irrelevant,
        namespace: "incorrect-namespace",
      });
      prefabNs2.setConfig(configs, projectEnvIdUnderTest, new Map());
      expect(prefabNs2.get("basic.namespace")).toEqual(["not-in-namespace"]);

      const prefabNsMissing = new Prefab({
        apiKey: irrelevant,
      });
      prefabNsMissing.setConfig(configs, projectEnvIdUnderTest, new Map());
      expect(prefabNsMissing.get("basic.namespace")).toEqual([
        "not-in-namespace",
      ]);
    });

    it("returns a config value for a PROP_IS_ONE_OF match", () => {
      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig(configs, projectEnvIdUnderTest, new Map());

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
      prefab.setConfig(configs, projectEnvIdUnderTest, new Map());

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

    it("can use prefab default context as an override", () => {
      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig(
        configs,
        projectEnvIdUnderTest,
        new Map([["prefab", new Map([["user-id", "5"]])]])
      );

      expect(prefab.get("prop.is.one.of")).toEqual("context-override");

      expect(
        prefab.get(
          "prop.is.one.of",
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
      ).toEqual("context-override");
    });

    it("returns a decrypted secret", () => {
      const decryptionKey = generateNewHexKey();
      const clearText = "very secret stuff";

      const encrypted = encrypt(clearText, decryptionKey);

      const secret: Config = secretConfig(encrypted);

      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig(
        [secret, decryptionKeyConfig(secret, decryptionKey)],
        projectEnvIdUnderTest,
        new Map()
      );

      expect(prefab.get(secret.key)).toEqual(clearText);
    });

    it("can load from a datafile", async () => {
      const prefab = new Prefab({
        apiKey: irrelevant,
        datafile: path.resolve("./src/__tests__/fixtures/datafile.json"),
      });

      await prefab.init();

      expect(prefab.get("from.the.datafile")).toEqual("it.works");
    });
  });

  describe("isFeatureEnabled", () => {
    describe("when the key cannot be found", () => {
      it("throws if no default is provided and onNoDefault is `error`", () => {
        const prefab = new Prefab({ apiKey: irrelevant });
        prefab.setConfig([], projectEnvIdUnderTest, new Map());

        expect(() => {
          prefab.isFeatureEnabled("missing.value");
        }).toThrow("No value found for key 'missing.value'");
      });

      it("returns false and warns if onNoDefault is `warn`", () => {
        const prefab = new Prefab({ apiKey: irrelevant, onNoDefault: "warn" });
        prefab.setConfig([], projectEnvIdUnderTest, new Map());

        jest.spyOn(console, "warn").mockImplementation();

        expect(prefab.isFeatureEnabled("missing.value")).toEqual(false);

        expect(console.warn).toHaveBeenCalledWith(
          "No value found for key 'missing.value'"
        );
      });

      it("returns false if onNoDefault is `ignore`", () => {
        const prefab = new Prefab({ apiKey: irrelevant, onNoDefault: "warn" });
        prefab.setConfig([], projectEnvIdUnderTest, new Map());

        jest.spyOn(console, "warn").mockImplementation();

        expect(prefab.isFeatureEnabled("missing.value")).toEqual(false);
      });
    });

    it("returns true when the flag matches", () => {
      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig(configs, projectEnvIdUnderTest, new Map());
      expect(prefab.isFeatureEnabled("basic.flag")).toEqual(true);
    });

    it("returns a random value for a weighted flag with no context", () => {
      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig(configs, projectEnvIdUnderTest, new Map());

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
      prefab.setConfig(configs, projectEnvIdUnderTest, new Map());

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

  describe("keys", () => {
    it("returns the keys of the known config", () => {
      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig(configs, projectEnvIdUnderTest, new Map());

      expect(prefab.keys()).toStrictEqual([
        "basic.value",
        "basic.flag",
        "basic.env",
        "basic.namespace",
        "prop.is.one.of",
        "prop.is.one.of.and.ends.with",
        "rollout.flag",
      ]);
    });
  });

  describe("raw", () => {
    it("returns a raw config", () => {
      const prefab = new Prefab({ apiKey: irrelevant });

      prefab.setConfig([], projectEnvIdUnderTest, new Map());

      expect(prefab.raw("basic.value")).toBeUndefined();

      prefab.setConfig(configs, projectEnvIdUnderTest, new Map());

      expect(JSON.stringify(prefab.raw("basic.value"))).toStrictEqual(
        '{"id":{"low":999,"high":0,"unsigned":false},"projectId":{"low":-1,"high":0,"unsigned":false},"key":"basic.value","rows":[{"properties":{},"values":[{"criteria":[],"value":{"int":{"low":42,"high":0,"unsigned":false}}}]}],"allowableValues":[],"configType":1,"valueType":1}'
      );
    });
  });

  describe("shouldLog", () => {
    it("returns true if the resolved level is greater than or equal to the desired level", () => {
      const loggerName = "a.b.c.d";

      const prefab = new Prefab({ apiKey: irrelevant });
      prefab.setConfig(
        [levelAt(loggerName, "info")],
        projectEnvIdUnderTest,
        new Map()
      );

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
      prefab.setConfig(
        [levelAt(loggerName, "info")],
        projectEnvIdUnderTest,
        new Map()
      );

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
      prefab.setConfig(
        [levelAt(loggerName, "trace")],
        projectEnvIdUnderTest,
        new Map()
      );

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
      prefab.setConfig([], projectEnvIdUnderTest, new Map());

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
      prefab.setConfig(
        [levelAt(loggerName, "info")],
        projectEnvIdUnderTest,
        new Map()
      );

      expect(
        prefab.shouldLog({
          loggerName,
          desiredLevel: "error",
        })
      ).toEqual(true);

      expect(prefab.telemetry.knownLoggers.data).toStrictEqual({});
    });
  });

  it("can fire onUpdate when the resolver sets config", async () => {
    const validApiKey = process.env["PREFAB_TEST_API_KEY"];

    if (validApiKey === undefined) {
      throw new Error(
        "You must set the PREFAB_TEST_API_KEY environment variable to run this test."
      );
    }

    const mock = jest.fn();

    const prefab = new Prefab({
      apiKey: validApiKey,
      collectLoggerCounts: false,
      contextUploadMode: "none",
      onUpdate: mock,
    });

    await prefab.init();

    expect(prefab.get("abc")).toEqual(true);

    while (mock.mock.calls.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(mock).toHaveBeenCalled();
  });
});
