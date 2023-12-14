import basicConfig from "./fixtures/basicConfig";
import basicLogLevel from "./fixtures/basicLogLevel";
import envConfig from "./fixtures/envConfig";
import namespaceConfig from "./fixtures/namespaceConfig";
import propDoesNotEndWithOneOf from "./fixtures/propDoesNotEndWithOneOf";
import propEndsWithOneOf from "./fixtures/propEndsWithOneOf";
import propIsNotOneOf from "./fixtures/propIsNotOneOf";
import propIsOneOf from "./fixtures/propIsOneOf";
import propIsOneOfAndEndsWith from "./fixtures/propIsOneOfAndEndsWith";
import rolloutFlag from "./fixtures/rolloutFlag";
import { Resolver } from "../resolver";
import type { EvaluateArgs } from "../evaluate";
import type { Contexts } from "../types";
import { evaluate } from "../evaluate";
import { emptyContexts, projectEnvIdUnderTest } from "./testHelpers";
import { encrypt, generateNewHexKey } from "../../src/encryption";
import secretConfig from "./fixtures/secretConfig";
import secretKeyConfig from "./fixtures/secretKeyConfig";
import decryptionKeyConfig, {
  decryptionKeyForSecret,
} from "./fixtures/decryptionKeyConfig";
import type { Config } from "../proto";
import { makeConfidential } from "../unwrap";
import { contextObjToMap } from "../mergeContexts";

const noNamespace = undefined;

// the Resolver is only used to back-reference Segments (which we test in the integration tests) and get secret keys so we can use a stand-in here.
const simpleResolver = new Resolver(
  [secretKeyConfig],
  projectEnvIdUnderTest,
  noNamespace,
  "error"
);

const usContexts = new Map([
  [
    "user",
    new Map([
      ["trackingId", "abc"],
      ["country", "US"],
    ]),
  ],
]);
const ukContexts = new Map([
  [
    "user",
    new Map([
      ["trackingId", "123"],
      ["country", "UK"],
    ]),
  ],
]);
const frContexts = new Map([["user", new Map([["country", "FR"]])]]);

const prefabEmailContexts = new Map([
  ["user", new Map([["email", "@prefab.cloud"]])],
]);
const exampleEmailContexts = new Map([
  ["user", new Map([["email", "@example.com"]])],
]);
const hotmailEmailContexts = new Map([
  ["user", new Map([["email", "@hotmail.com"]])],
]);

const secretContexts = contextObjToMap({
  user: { trackingId: "SECRET" },
});
const confidentialContexts = contextObjToMap({
  user: { trackingId: "CONFIDENTIAL" },
});

describe("evaluate", () => {
  it("returns an evaluation with no rules", () => {
    expect(
      evaluate({
        config: basicConfig,
        projectEnvId: projectEnvIdUnderTest,
        namespace: noNamespace,
        contexts: emptyContexts,
        resolver: simpleResolver,
      })
    ).toStrictEqual({
      configId: basicConfig.id,
      configKey: basicConfig.key,
      configType: basicConfig.configType,
      configRowIndex: 0,
      unwrappedValue: 42,
      reportableValue: undefined,
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });
  });

  it("returns a config logLevel value with no rules", () => {
    expect(
      evaluate({
        config: basicLogLevel,
        projectEnvId: projectEnvIdUnderTest,
        namespace: noNamespace,
        contexts: emptyContexts,
        resolver: simpleResolver,
      })
    ).toStrictEqual({
      configId: basicLogLevel.id,
      configKey: basicLogLevel.key,
      configType: basicLogLevel.configType,
      configRowIndex: 0,
      conditionalValueIndex: 0,
      unwrappedValue: 3,
      reportableValue: undefined,
      weightedValueIndex: undefined,
    });
  });

  it("returns an evaluation with no rules but an environment", () => {
    expect(
      evaluate({
        config: envConfig,
        projectEnvId: projectEnvIdUnderTest,
        namespace: noNamespace,
        contexts: emptyContexts,
        resolver: simpleResolver,
      })
    ).toStrictEqual({
      configId: envConfig.id,
      configKey: envConfig.key,
      configType: envConfig.configType,
      configRowIndex: 0,
      unwrappedValue: ["a", "b", "c", "d"],
      reportableValue: undefined,
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });
  });

  it("returns an evaluation for a rollout", () => {
    const args = (contexts: Contexts): EvaluateArgs => ({
      config: rolloutFlag,
      namespace: undefined,
      projectEnvId: projectEnvIdUnderTest,
      contexts,
      resolver: simpleResolver,
    });

    expect(evaluate(args(ukContexts))).toStrictEqual({
      configId: rolloutFlag.id,
      configKey: rolloutFlag.key,
      conditionalValueIndex: 0,
      configRowIndex: 0,
      configType: 2,
      unwrappedValue: true,
      reportableValue: undefined,
      weightedValueIndex: 1,
    });

    expect(evaluate(args(usContexts))).toStrictEqual({
      configId: rolloutFlag.id,
      configKey: rolloutFlag.key,
      conditionalValueIndex: 0,
      configRowIndex: 0,
      configType: 2,
      unwrappedValue: false,
      reportableValue: undefined,
      weightedValueIndex: 0,
    });
  });

  it("returns an evaluation for a namespace", () => {
    const args = (namespace: string | undefined): EvaluateArgs => ({
      config: namespaceConfig,
      projectEnvId: projectEnvIdUnderTest,
      namespace,
      contexts: emptyContexts,
      resolver: simpleResolver,
    });

    expect(evaluate(args("my-namespace"))).toStrictEqual({
      configId: namespaceConfig.id,
      configType: namespaceConfig.configType,
      configKey: namespaceConfig.key,
      unwrappedValue: ["in-namespace"],
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args("wrong-namespace"))).toStrictEqual({
      configId: namespaceConfig.id,
      configKey: namespaceConfig.key,
      configType: namespaceConfig.configType,
      unwrappedValue: ["wrong-namespace"],
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args("incorrect"))).toStrictEqual({
      configId: namespaceConfig.id,
      configKey: namespaceConfig.key,
      configType: namespaceConfig.configType,
      unwrappedValue: ["not-in-namespace"],
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 2,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(noNamespace))).toEqual({
      configId: namespaceConfig.id,
      configKey: namespaceConfig.key,
      configType: namespaceConfig.configType,
      unwrappedValue: ["not-in-namespace"],
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 2,
      weightedValueIndex: undefined,
    });
  });

  it("returns an evaluation for a PROP_IS_ONE_OF match", () => {
    const args = (contexts: Contexts): EvaluateArgs => ({
      config: propIsOneOf,
      projectEnvId: projectEnvIdUnderTest,
      namespace: noNamespace,
      contexts,
      resolver: simpleResolver,
    });

    expect(evaluate(args(emptyContexts))).toStrictEqual({
      configId: propIsOneOf.id,
      configKey: propIsOneOf.key,
      configType: propIsOneOf.configType,
      unwrappedValue: "default",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 4,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(usContexts))).toStrictEqual({
      configId: propIsOneOf.id,
      configKey: propIsOneOf.key,
      configType: propIsOneOf.configType,
      unwrappedValue: "correct",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(ukContexts))).toStrictEqual({
      configId: propIsOneOf.id,
      configKey: propIsOneOf.key,
      configType: propIsOneOf.configType,
      unwrappedValue: "correct",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(frContexts))).toStrictEqual({
      configId: propIsOneOf.id,
      configKey: propIsOneOf.key,
      configType: propIsOneOf.configType,
      unwrappedValue: "default",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 4,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(secretContexts))).toStrictEqual({
      configId: propIsOneOf.id,
      configKey: propIsOneOf.key,
      configType: propIsOneOf.configType,
      unwrappedValue: "some-secret",
      reportableValue: "*****cda9e",
      configRowIndex: 0,
      conditionalValueIndex: 3,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(confidentialContexts))).toStrictEqual({
      configId: propIsOneOf.id,
      configKey: propIsOneOf.key,
      configType: propIsOneOf.configType,
      unwrappedValue: "For British Eyes Only",
      reportableValue: "*****b9002",
      configRowIndex: 0,
      conditionalValueIndex: 2,
      weightedValueIndex: undefined,
    });
  });

  it("returns an evaluation for a PROP_IS_NOT_ONE_OF match", () => {
    const args = (contexts: Contexts): EvaluateArgs => ({
      config: propIsNotOneOf,
      projectEnvId: projectEnvIdUnderTest,
      namespace: noNamespace,
      contexts,
      resolver: simpleResolver,
    });

    expect(evaluate(args(emptyContexts))).toStrictEqual({
      configId: propIsNotOneOf.id,
      configKey: propIsNotOneOf.key,
      configType: propIsNotOneOf.configType,
      unwrappedValue: "correct",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(usContexts))).toStrictEqual({
      configId: propIsNotOneOf.id,
      configKey: propIsNotOneOf.key,
      configType: propIsNotOneOf.configType,
      unwrappedValue: "default",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(ukContexts))).toStrictEqual({
      configId: propIsNotOneOf.id,
      configKey: propIsNotOneOf.key,
      configType: propIsNotOneOf.configType,
      unwrappedValue: "default",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(frContexts))).toStrictEqual({
      configId: propIsNotOneOf.id,
      configKey: propIsNotOneOf.key,
      configType: propIsNotOneOf.configType,
      configRowIndex: 0,
      unwrappedValue: "correct",
      reportableValue: undefined,
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });
  });

  it("returns an evaluation for a PROP_ENDS_WITH_ONE_OF match", () => {
    const args = (contexts: Contexts): EvaluateArgs => ({
      config: propEndsWithOneOf,
      projectEnvId: projectEnvIdUnderTest,
      namespace: noNamespace,
      contexts,
      resolver: simpleResolver,
    });

    expect(evaluate(args(emptyContexts))).toStrictEqual({
      configId: propEndsWithOneOf.id,
      configKey: propEndsWithOneOf.key,
      configType: propEndsWithOneOf.configType,
      unwrappedValue: "default",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(prefabEmailContexts))).toStrictEqual({
      configId: propEndsWithOneOf.id,
      configKey: propEndsWithOneOf.key,
      configType: propEndsWithOneOf.configType,
      unwrappedValue: "correct",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(exampleEmailContexts))).toStrictEqual({
      configId: propEndsWithOneOf.id,
      configKey: propEndsWithOneOf.key,
      configType: propEndsWithOneOf.configType,
      unwrappedValue: "correct",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(hotmailEmailContexts))).toStrictEqual({
      configId: propEndsWithOneOf.id,
      configKey: propEndsWithOneOf.key,
      configType: propEndsWithOneOf.configType,
      unwrappedValue: "default",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });
  });

  it("returns an evaluation for a PROP_DOES_NOT_END_WITH_ONE_OF match", () => {
    const args = (contexts: Contexts): EvaluateArgs => ({
      config: propDoesNotEndWithOneOf,
      projectEnvId: projectEnvIdUnderTest,
      namespace: noNamespace,
      contexts,
      resolver: simpleResolver,
    });

    expect(evaluate(args(emptyContexts))).toStrictEqual({
      configId: propDoesNotEndWithOneOf.id,
      configKey: propDoesNotEndWithOneOf.key,
      configType: propDoesNotEndWithOneOf.configType,
      unwrappedValue: "correct",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(prefabEmailContexts))).toStrictEqual({
      configId: propDoesNotEndWithOneOf.id,
      configKey: propDoesNotEndWithOneOf.key,
      configType: propDoesNotEndWithOneOf.configType,
      unwrappedValue: "default",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(exampleEmailContexts))).toStrictEqual({
      configId: propDoesNotEndWithOneOf.id,
      configKey: propDoesNotEndWithOneOf.key,
      configType: propDoesNotEndWithOneOf.configType,
      unwrappedValue: "default",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(hotmailEmailContexts))).toStrictEqual({
      configId: propDoesNotEndWithOneOf.id,
      configKey: propDoesNotEndWithOneOf.key,
      configType: propDoesNotEndWithOneOf.configType,
      unwrappedValue: "correct",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });
  });

  it("returns an evaluation for a PROP_IS_ONE_OF and PROP_ENDS_WITH_ONE_OF match", () => {
    const args = (contexts: Contexts): EvaluateArgs => ({
      config: propIsOneOfAndEndsWith,
      projectEnvId: projectEnvIdUnderTest,
      namespace: noNamespace,
      contexts,
      resolver: simpleResolver,
    });

    expect(evaluate(args(emptyContexts))).toStrictEqual({
      configId: propIsOneOfAndEndsWith.id,
      configKey: propIsOneOfAndEndsWith.key,
      configType: propIsOneOfAndEndsWith.configType,
      unwrappedValue: "default",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(usContexts))).toStrictEqual({
      configId: propIsOneOfAndEndsWith.id,
      configKey: propIsOneOfAndEndsWith.key,
      configType: propIsOneOfAndEndsWith.configType,
      unwrappedValue: "default",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(prefabEmailContexts))).toStrictEqual({
      configId: propIsOneOfAndEndsWith.id,
      configKey: propIsOneOfAndEndsWith.key,
      configType: propIsOneOfAndEndsWith.configType,
      unwrappedValue: "default",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    const frPrefabContexts = new Map([
      [
        "user",
        new Map([
          ["country", "FR"],
          ["email", "test@prefab.cloud"],
        ]),
      ],
    ]);
    expect(evaluate(args(frPrefabContexts))).toStrictEqual({
      configId: propIsOneOfAndEndsWith.id,
      configKey: propIsOneOfAndEndsWith.key,
      configType: propIsOneOfAndEndsWith.configType,
      unwrappedValue: "default",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    const usPrefabContexts = new Map([
      [
        "user",
        new Map([
          ["country", "US"],
          ["email", "test@prefab.cloud"],
        ]),
      ],
    ]);
    expect(evaluate(args(usPrefabContexts))).toStrictEqual({
      configId: propIsOneOfAndEndsWith.id,
      configKey: propIsOneOfAndEndsWith.key,
      configType: propIsOneOfAndEndsWith.configType,
      unwrappedValue: "correct",
      reportableValue: undefined,
      configRowIndex: 0,
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });
  });

  it("returns an evaluation for a secret when the key is found", () => {
    const decryptionKey = generateNewHexKey();
    const clearText = "very secret stuff";

    const encrypted = encrypt(clearText, decryptionKey);

    const secret: Config = secretConfig(encrypted);

    const decryptionConfig = decryptionKeyConfig(secret, decryptionKey);

    const resolver = new Resolver(
      [decryptionConfig],
      projectEnvIdUnderTest,
      noNamespace,
      "error"
    );

    expect(
      evaluate({
        config: secret,
        projectEnvId: projectEnvIdUnderTest,
        namespace: noNamespace,
        contexts: emptyContexts,
        resolver,
      })
    ).toStrictEqual({
      configId: secret.id,
      configKey: secret.key,
      configType: secret.configType,
      reportableValue: makeConfidential(encrypted),
      configRowIndex: 0,
      unwrappedValue: clearText,
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });
  });

  it("throws for a secret when the key cannot be found", () => {
    const decryptionKey = generateNewHexKey();
    const clearText = "very secret stuff";

    const encrypted = encrypt(clearText, decryptionKey);

    const secret: Config = secretConfig(encrypted);

    const emptyResolver = new Resolver(
      [],
      projectEnvIdUnderTest,
      noNamespace,
      "error"
    );

    expect(() => {
      evaluate({
        config: secret,
        projectEnvId: projectEnvIdUnderTest,
        namespace: noNamespace,
        contexts: emptyContexts,
        resolver: emptyResolver,
      });
    }).toThrowError(
      `No value found for key '${decryptionKeyForSecret(secret)}'`
    );
  });
});
