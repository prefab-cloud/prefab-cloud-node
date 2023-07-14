import basicConfig from "./fixtures/basicConfig";
import basicLogLevel from "./fixtures/basicLogLevel";
import envConfig from "./fixtures/envConfig";
import namespaceConfig from "./fixtures/namespaceConfig";
import propDoesNotEndWithOneOf from "./fixtures/propDoesNotEndWithOneOf";
import propEndsWithOneOf from "./fixtures/propEndsWithOneOf";
import propIsNotOneOf from "./fixtures/propIsNotOneOf";
import propIsOneOf from "./fixtures/propIsOneOf";
import propIsOneOfAndEndsWith from "./fixtures/propIsOneOfAndEndsWith";
import { Resolver } from "../resolver";
import type { EvaluateArgs } from "../evaluate";
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

describe.only("evaluate", () => {
  it("returns a config value with no rules", () => {
    expect(
      evaluate({
        config: basicConfig,
        projectEnvId: projectEnvIdUnderTest,
        namespace: noNamespace,
        contexts: emptyContexts,
        resolver: emptyResolver,
      })
    ).toEqual(42);
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
    ).toEqual(3);
  });

  it("returns a config value with no rules but an environment", () => {
    expect(
      evaluate({
        config: envConfig,
        projectEnvId: projectEnvIdUnderTest,
        namespace: noNamespace,
        contexts: emptyContexts,
        resolver: emptyResolver,
      })
    ).toEqual(["a", "b", "c", "d"]);
  });

  it("returns a config value for a namespace", () => {
    const args = (namespace: string | undefined): EvaluateArgs => ({
      config: namespaceConfig,
      projectEnvId: projectEnvIdUnderTest,
      namespace,
      contexts: emptyContexts,
      resolver: emptyResolver,
    });

    expect(evaluate(args("my-namespace"))).toEqual(["in-namespace"]);
    expect(evaluate(args("incorrect"))).toEqual(["not-in-namespace"]);
    expect(evaluate(args(noNamespace))).toEqual(["not-in-namespace"]);
  });

  it("returns a config value for a PROP_IS_ONE_OF match", () => {
    const args = (
      contexts: Map<string, Map<string, string>>
    ): EvaluateArgs => ({
      config: propIsOneOf,
      projectEnvId: projectEnvIdUnderTest,
      namespace: noNamespace,
      contexts,
      resolver: emptyResolver,
    });

    expect(evaluate(args(emptyContexts))).toEqual("default");

    expect(
      evaluate(args(new Map([["user", new Map([["country", "US"]])]])))
    ).toEqual("correct");

    expect(
      evaluate(args(new Map([["user", new Map([["country", "UK"]])]])))
    ).toEqual("correct");

    expect(
      evaluate(args(new Map([["user", new Map([["country", "FR"]])]])))
    ).toEqual("default");
  });

  it("returns a config value for a PROP_IS_NOT_ONE_OF match", () => {
    const args = (
      contexts: Map<string, Map<string, string>>
    ): EvaluateArgs => ({
      config: propIsNotOneOf,
      projectEnvId: projectEnvIdUnderTest,
      namespace: noNamespace,
      contexts,
      resolver: emptyResolver,
    });

    expect(evaluate(args(emptyContexts))).toEqual("correct");

    expect(
      evaluate(args(new Map([["user", new Map([["country", "US"]])]])))
    ).toEqual("default");

    expect(
      evaluate(args(new Map([["user", new Map([["country", "UK"]])]])))
    ).toEqual("default");

    expect(
      evaluate(args(new Map([["user", new Map([["country", "FR"]])]])))
    ).toEqual("correct");
  });

  it("returns a config value for a PROP_ENDS_WITH_ONE_OF match", () => {
    const args = (
      contexts: Map<string, Map<string, string>>
    ): EvaluateArgs => ({
      config: propEndsWithOneOf,
      projectEnvId: projectEnvIdUnderTest,
      namespace: noNamespace,
      contexts,
      resolver: emptyResolver,
    });

    expect(evaluate(args(emptyContexts))).toEqual("default");

    expect(
      evaluate(args(new Map([["user", new Map([["email", "@prefab.cloud"]])]])))
    ).toEqual("correct");

    expect(
      evaluate(args(new Map([["user", new Map([["email", "@example.com"]])]])))
    ).toEqual("correct");

    expect(
      evaluate(args(new Map([["user", new Map([["email", "@hotmail.com"]])]])))
    ).toEqual("default");
  });

  it("returns a config value for a PROP_DOES_NOT_END_WITH_ONE_OF  match", () => {
    const args = (
      contexts: Map<string, Map<string, string>>
    ): EvaluateArgs => ({
      config: propDoesNotEndWithOneOf,
      projectEnvId: projectEnvIdUnderTest,
      namespace: noNamespace,
      contexts,
      resolver: emptyResolver,
    });

    expect(evaluate(args(emptyContexts))).toEqual("correct");

    expect(
      evaluate(args(new Map([["user", new Map([["email", "@prefab.cloud"]])]])))
    ).toEqual("default");

    expect(
      evaluate(args(new Map([["user", new Map([["email", "@example.com"]])]])))
    ).toEqual("default");

    expect(
      evaluate(args(new Map([["user", new Map([["email", "@hotmail.com"]])]])))
    ).toEqual("correct");
  });

  it("returns a config value for a PROP_IS_ONE_OF and PROP_ENDS_WITH_ONE_OF match", () => {
    const args = (
      contexts: Map<string, Map<string, string>>
    ): EvaluateArgs => ({
      config: propIsOneOfAndEndsWith,
      projectEnvId: projectEnvIdUnderTest,
      namespace: noNamespace,
      contexts,
      resolver: emptyResolver,
    });

    expect(evaluate(args(new Map()))).toEqual("default");

    expect(
      evaluate(args(new Map([["user", new Map([["country", "US"]])]])))
    ).toEqual("default");

    expect(
      evaluate(
        args(new Map([["user", new Map([["email", "test@prefab.cloud"]])]]))
      )
    ).toEqual("default");

    expect(
      evaluate(
        args(
          new Map([
            [
              "user",
              new Map([
                ["country", "FR"],
                ["email", "test@prefab.cloud"],
              ]),
            ],
          ])
        )
      )
    ).toEqual("default");

    expect(
      evaluate(
        args(
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
      )
    ).toEqual("correct");
  });
});
