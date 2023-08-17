import Long from "long";
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

const noNamespace = undefined;

// the Resolver is only used to back-reference Segments (which we test in the integration tests) so we can use a stand-in here.
const emptyResolver = new Resolver(
  [],
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

describe("evaluate", () => {
  it("returns an evaluation with no rules", () => {
    expect(
      evaluate({
        config: basicConfig,
        projectEnvId: projectEnvIdUnderTest,
        namespace: noNamespace,
        contexts: emptyContexts,
        resolver: emptyResolver,
      })
    ).toStrictEqual({
      configId: basicConfig.id,
      configKey: basicConfig.key,
      configType: basicConfig.configType,
      configRowIndex: 0,
      unwrappedValue: 42,
      conditionalValueIndex: 0,
      selectedValue: { int: new Long(42) },
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
        resolver: emptyResolver,
      })
    ).toStrictEqual({
      configId: basicLogLevel.id,
      configKey: basicLogLevel.key,
      configType: basicLogLevel.configType,
      configRowIndex: 0,
      conditionalValueIndex: 0,
      unwrappedValue: 3,
      selectedValue: { logLevel: 3 },
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
        resolver: emptyResolver,
      })
    ).toStrictEqual({
      configId: envConfig.id,
      configKey: envConfig.key,
      configType: envConfig.configType,
      configRowIndex: 0,
      unwrappedValue: ["a", "b", "c", "d"],
      conditionalValueIndex: 0,
      selectedValue: { stringList: { values: ["a", "b", "c", "d"] } },
      weightedValueIndex: undefined,
    });
  });

  it("returns an evaluation for a rollout", () => {
    const args = (contexts: Contexts): EvaluateArgs => ({
      config: rolloutFlag,
      namespace: undefined,
      projectEnvId: projectEnvIdUnderTest,
      contexts,
      resolver: emptyResolver,
    });

    expect(evaluate(args(ukContexts))).toStrictEqual({
      configId: rolloutFlag.id,
      configKey: rolloutFlag.key,
      conditionalValueIndex: 0,
      configRowIndex: 0,
      configType: 2,
      selectedValue: {
        weightedValues: {
          hashByPropertyName: "user.trackingId",
          weightedValues: [
            { value: { bool: false }, weight: 90 },
            { value: { bool: true }, weight: 10 },
          ],
        },
      },
      unwrappedValue: true,
      weightedValueIndex: 1,
    });

    expect(evaluate(args(usContexts))).toStrictEqual({
      configId: rolloutFlag.id,
      configKey: rolloutFlag.key,
      conditionalValueIndex: 0,
      configRowIndex: 0,
      configType: 2,
      selectedValue: {
        weightedValues: {
          hashByPropertyName: "user.trackingId",
          weightedValues: [
            { value: { bool: false }, weight: 90 },
            { value: { bool: true }, weight: 10 },
          ],
        },
      },
      unwrappedValue: false,
      weightedValueIndex: 0,
    });
  });

  it("returns an evaluation for a namespace", () => {
    const args = (namespace: string | undefined): EvaluateArgs => ({
      config: namespaceConfig,
      projectEnvId: projectEnvIdUnderTest,
      namespace,
      contexts: emptyContexts,
      resolver: emptyResolver,
    });

    expect(evaluate(args("my-namespace"))).toStrictEqual({
      configId: namespaceConfig.id,
      configType: namespaceConfig.configType,
      configKey: namespaceConfig.key,
      unwrappedValue: ["in-namespace"],
      configRowIndex: 0,
      conditionalValueIndex: 1,
      selectedValue: { stringList: { values: ["in-namespace"] } },
      weightedValueIndex: undefined,
    });

    expect(evaluate(args("wrong-namespace"))).toStrictEqual({
      configId: namespaceConfig.id,
      configKey: namespaceConfig.key,
      configType: namespaceConfig.configType,
      unwrappedValue: ["wrong-namespace"],
      configRowIndex: 0,
      conditionalValueIndex: 0,
      selectedValue: { stringList: { values: ["wrong-namespace"] } },
      weightedValueIndex: undefined,
    });

    expect(evaluate(args("incorrect"))).toStrictEqual({
      configId: namespaceConfig.id,
      configKey: namespaceConfig.key,
      configType: namespaceConfig.configType,
      unwrappedValue: ["not-in-namespace"],
      configRowIndex: 0,
      conditionalValueIndex: 2,
      selectedValue: { stringList: { values: ["not-in-namespace"] } },
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(noNamespace))).toEqual({
      configId: namespaceConfig.id,
      configKey: namespaceConfig.key,
      configType: namespaceConfig.configType,
      unwrappedValue: ["not-in-namespace"],
      configRowIndex: 0,
      conditionalValueIndex: 2,
      selectedValue: { stringList: { values: ["not-in-namespace"] } },
      weightedValueIndex: undefined,
    });
  });

  it("returns an evaluation for a PROP_IS_ONE_OF match", () => {
    const args = (
      contexts: Map<string, Map<string, string>>
    ): EvaluateArgs => ({
      config: propIsOneOf,
      projectEnvId: projectEnvIdUnderTest,
      namespace: noNamespace,
      contexts,
      resolver: emptyResolver,
    });

    expect(evaluate(args(emptyContexts))).toStrictEqual({
      configId: propIsOneOf.id,
      configKey: propIsOneOf.key,
      configType: propIsOneOf.configType,
      unwrappedValue: "default",
      configRowIndex: 0,
      selectedValue: { string: "default" },
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(usContexts))).toStrictEqual({
      configId: propIsOneOf.id,
      configKey: propIsOneOf.key,
      configType: propIsOneOf.configType,
      unwrappedValue: "correct",
      configRowIndex: 0,
      selectedValue: { string: "correct" },
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(ukContexts))).toStrictEqual({
      configId: propIsOneOf.id,
      configKey: propIsOneOf.key,
      configType: propIsOneOf.configType,
      unwrappedValue: "correct",
      configRowIndex: 0,
      selectedValue: { string: "correct" },
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(frContexts))).toStrictEqual({
      configId: propIsOneOf.id,
      configKey: propIsOneOf.key,
      configType: propIsOneOf.configType,
      unwrappedValue: "default",
      configRowIndex: 0,
      selectedValue: { string: "default" },
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });
  });

  it("returns an evaluation for a PROP_IS_NOT_ONE_OF match", () => {
    const args = (
      contexts: Map<string, Map<string, string>>
    ): EvaluateArgs => ({
      config: propIsNotOneOf,
      projectEnvId: projectEnvIdUnderTest,
      namespace: noNamespace,
      contexts,
      resolver: emptyResolver,
    });

    expect(evaluate(args(emptyContexts))).toStrictEqual({
      configId: propIsNotOneOf.id,
      configKey: propIsNotOneOf.key,
      configType: propIsNotOneOf.configType,
      unwrappedValue: "correct",
      configRowIndex: 0,
      selectedValue: { string: "correct" },
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(usContexts))).toStrictEqual({
      configId: propIsNotOneOf.id,
      configKey: propIsNotOneOf.key,
      configType: propIsNotOneOf.configType,
      unwrappedValue: "default",
      configRowIndex: 0,
      selectedValue: { string: "default" },
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(ukContexts))).toStrictEqual({
      configId: propIsNotOneOf.id,
      configKey: propIsNotOneOf.key,
      configType: propIsNotOneOf.configType,
      unwrappedValue: "default",
      configRowIndex: 0,
      selectedValue: { string: "default" },
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(frContexts))).toStrictEqual({
      configId: propIsNotOneOf.id,
      configKey: propIsNotOneOf.key,
      configType: propIsNotOneOf.configType,
      configRowIndex: 0,
      unwrappedValue: "correct",
      selectedValue: { string: "correct" },
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });
  });

  it("returns an evaluation for a PROP_ENDS_WITH_ONE_OF match", () => {
    const args = (
      contexts: Map<string, Map<string, string>>
    ): EvaluateArgs => ({
      config: propEndsWithOneOf,
      projectEnvId: projectEnvIdUnderTest,
      namespace: noNamespace,
      contexts,
      resolver: emptyResolver,
    });

    expect(evaluate(args(emptyContexts))).toStrictEqual({
      configId: propEndsWithOneOf.id,
      configKey: propEndsWithOneOf.key,
      configType: propEndsWithOneOf.configType,
      unwrappedValue: "default",
      configRowIndex: 0,
      selectedValue: { string: "default" },
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(prefabEmailContexts))).toStrictEqual({
      configId: propEndsWithOneOf.id,
      configKey: propEndsWithOneOf.key,
      configType: propEndsWithOneOf.configType,
      unwrappedValue: "correct",
      configRowIndex: 0,
      selectedValue: { string: "correct" },
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(exampleEmailContexts))).toStrictEqual({
      configId: propEndsWithOneOf.id,
      configKey: propEndsWithOneOf.key,
      configType: propEndsWithOneOf.configType,
      unwrappedValue: "correct",
      configRowIndex: 0,
      selectedValue: { string: "correct" },
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(hotmailEmailContexts))).toStrictEqual({
      configId: propEndsWithOneOf.id,
      configKey: propEndsWithOneOf.key,
      configType: propEndsWithOneOf.configType,
      unwrappedValue: "default",
      configRowIndex: 0,
      selectedValue: { string: "default" },
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });
  });

  it("returns an evaluation for a PROP_DOES_NOT_END_WITH_ONE_OF match", () => {
    const args = (
      contexts: Map<string, Map<string, string>>
    ): EvaluateArgs => ({
      config: propDoesNotEndWithOneOf,
      projectEnvId: projectEnvIdUnderTest,
      namespace: noNamespace,
      contexts,
      resolver: emptyResolver,
    });

    expect(evaluate(args(emptyContexts))).toStrictEqual({
      configId: propDoesNotEndWithOneOf.id,
      configKey: propDoesNotEndWithOneOf.key,
      configType: propDoesNotEndWithOneOf.configType,
      unwrappedValue: "correct",
      configRowIndex: 0,
      selectedValue: { string: "correct" },
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(prefabEmailContexts))).toStrictEqual({
      configId: propDoesNotEndWithOneOf.id,
      configKey: propDoesNotEndWithOneOf.key,
      configType: propDoesNotEndWithOneOf.configType,
      unwrappedValue: "default",
      configRowIndex: 0,
      selectedValue: { string: "default" },
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(exampleEmailContexts))).toStrictEqual({
      configId: propDoesNotEndWithOneOf.id,
      configKey: propDoesNotEndWithOneOf.key,
      configType: propDoesNotEndWithOneOf.configType,
      unwrappedValue: "default",
      configRowIndex: 0,
      selectedValue: { string: "default" },
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(hotmailEmailContexts))).toStrictEqual({
      configId: propDoesNotEndWithOneOf.id,
      configKey: propDoesNotEndWithOneOf.key,
      configType: propDoesNotEndWithOneOf.configType,
      unwrappedValue: "correct",
      configRowIndex: 0,
      selectedValue: { string: "correct" },
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });
  });

  it("returns an evaluation for a PROP_IS_ONE_OF and PROP_ENDS_WITH_ONE_OF match", () => {
    const args = (
      contexts: Map<string, Map<string, string>>
    ): EvaluateArgs => ({
      config: propIsOneOfAndEndsWith,
      projectEnvId: projectEnvIdUnderTest,
      namespace: noNamespace,
      contexts,
      resolver: emptyResolver,
    });

    expect(evaluate(args(emptyContexts))).toStrictEqual({
      configId: propIsOneOfAndEndsWith.id,
      configKey: propIsOneOfAndEndsWith.key,
      configType: propIsOneOfAndEndsWith.configType,
      unwrappedValue: "default",
      configRowIndex: 0,
      selectedValue: { string: "default" },
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(usContexts))).toStrictEqual({
      configId: propIsOneOfAndEndsWith.id,
      configKey: propIsOneOfAndEndsWith.key,
      configType: propIsOneOfAndEndsWith.configType,
      unwrappedValue: "default",
      configRowIndex: 0,
      selectedValue: { string: "default" },
      conditionalValueIndex: 1,
      weightedValueIndex: undefined,
    });

    expect(evaluate(args(prefabEmailContexts))).toStrictEqual({
      configId: propIsOneOfAndEndsWith.id,
      configKey: propIsOneOfAndEndsWith.key,
      configType: propIsOneOfAndEndsWith.configType,
      unwrappedValue: "default",
      configRowIndex: 0,
      selectedValue: { string: "default" },
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
      configRowIndex: 0,
      selectedValue: { string: "default" },
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
      configRowIndex: 0,
      selectedValue: { string: "correct" },
      conditionalValueIndex: 0,
      weightedValueIndex: undefined,
    });
  });
});
