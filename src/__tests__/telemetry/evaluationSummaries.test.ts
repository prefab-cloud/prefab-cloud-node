import Long from "long";
import { Prefab } from "../../prefab";
import { evaluationSummaries, stub } from "../../telemetry/evaluationSummaries";
import { Resolver } from "../../resolver";
import type { Config } from "../../proto";

import {
  emptyContexts,
  projectEnvIdUnderTest,
  mockApiClient,
  irrelevant,
} from "../testHelpers";

import { evaluate, type Evaluation } from "../../evaluate";
import propIsOneOf from "../fixtures/propIsOneOf";
import basicConfig from "../fixtures/basicConfig";
import basicLogLevel from "../fixtures/basicLogLevel";
import rolloutFlag from "../fixtures/rolloutFlag";

const instanceHash = "instance-hash";

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
const frContexts = new Map([
  [
    "user",
    new Map([
      ["trackingId", "xyz"],
      ["country", "FR"],
    ]),
  ],
]);

const noNamespace = undefined;

// the Resolver is only used to back-reference Segments (which we test in the integration tests) so we can use a stand-in here.
const emptyResolver = new Resolver(
  [],
  projectEnvIdUnderTest,
  noNamespace,
  "error"
);

const evaluationFor = (
  config: Config,
  contexts: Map<string, Map<string, string>>
): Evaluation => {
  return evaluate({
    config,
    projectEnvId: projectEnvIdUnderTest,
    namespace: noNamespace,
    contexts,
    resolver: emptyResolver,
  });
};

describe("evaluationSummaries", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it("returns a stub if collectEvaluationSummaries is false", () => {
    expect(evaluationSummaries(mockApiClient, instanceHash, false)).toBe(stub);
  });

  it("pushes data", () => {
    const aggregator = evaluationSummaries(mockApiClient, instanceHash, true);

    aggregator.push(evaluationFor(propIsOneOf, usContexts));
    aggregator.push(evaluationFor(propIsOneOf, ukContexts));
    aggregator.push(evaluationFor(propIsOneOf, frContexts));
    aggregator.push(evaluationFor(propIsOneOf, emptyContexts));
    aggregator.push(evaluationFor(propIsOneOf, emptyContexts));

    expect(aggregator.data).toEqual(
      new Map([
        [
          '["prop.is.one.of","1"]',
          new Map([
            ['["991",1,0,"string","correct",null]', 2],
            ['["991",2,0,"string","default",null]', 3],
          ]),
        ],
      ])
    );

    aggregator.push(evaluationFor(propIsOneOf, emptyContexts));
    aggregator.push(evaluationFor(basicConfig, usContexts));

    // Log level doesn't show up below because we don't report them
    aggregator.push(evaluationFor(basicLogLevel, usContexts));
    aggregator.push(evaluationFor(basicLogLevel, emptyContexts));

    expect(aggregator.data).toEqual(
      new Map([
        [
          '["prop.is.one.of","1"]',
          new Map([
            ['["991",1,0,"string","correct",null]', 2],
            ['["991",2,0,"string","default",null]', 4],
          ]),
        ],
        ['["basic.value","1"]', new Map([['["999",0,0,"int",42,null]', 1]])],
      ])
    );
  });

  it("works for weighted values", () => {
    const aggregator = evaluationSummaries(mockApiClient, instanceHash, true);

    aggregator.push(evaluationFor(rolloutFlag, usContexts));
    aggregator.push(evaluationFor(rolloutFlag, ukContexts));
    aggregator.push(evaluationFor(rolloutFlag, frContexts));

    expect(aggregator.data).toStrictEqual(
      new Map([
        [
          '["rollout.flag","2"]',
          new Map([
            ['["4294967295",0,0,"bool",false,0]', 2],
            ['["4294967295",0,0,"bool",true,1]', 1],
          ]),
        ],
      ])
    );
  });

  it("should sync to the server", async () => {
    const aggregator = evaluationSummaries(mockApiClient, instanceHash, true);

    if (!aggregator.enabled) {
      throw new Error("aggregator is not enabled");
    }

    aggregator.push(evaluationFor(propIsOneOf, usContexts));
    aggregator.push(evaluationFor(propIsOneOf, ukContexts));
    aggregator.push(evaluationFor(propIsOneOf, frContexts));
    aggregator.push(evaluationFor(propIsOneOf, emptyContexts));
    aggregator.push(evaluationFor(propIsOneOf, emptyContexts));
    aggregator.push(evaluationFor(basicConfig, usContexts));
    aggregator.push(evaluationFor(basicLogLevel, usContexts));
    aggregator.push(evaluationFor(basicLogLevel, emptyContexts));

    const start = Date.now();
    jest.advanceTimersByTime(1000);

    const syncResult = await aggregator.sync();

    expect(mockApiClient.fetch).toHaveBeenCalled();

    if (syncResult === undefined) {
      throw new Error("syncResult is undefined");
    }

    expect(syncResult.status).toEqual(200);

    expect(syncResult.dataSent).toStrictEqual({
      instanceHash: "instance-hash",
      events: [
        {
          summaries: {
            start: Long.fromNumber(start),
            end: Long.fromNumber(Date.now()),
            summaries: [
              {
                key: "prop.is.one.of",
                type: "1",
                counters: [
                  {
                    configId: Long.fromNumber(991),
                    conditionalValueIndex: 1,
                    configRowIndex: 0,
                    selectedValue: {
                      string: "correct",
                    },
                    count: Long.fromNumber(2),
                    reason: 0,
                  },
                  {
                    configId: Long.fromNumber(991),
                    conditionalValueIndex: 2,
                    configRowIndex: 0,
                    selectedValue: {
                      string: "default",
                    },
                    count: Long.fromNumber(3),
                    reason: 0,
                  },
                ],
              },
              {
                key: "basic.value",
                type: "1",
                counters: [
                  {
                    configId: Long.fromNumber(999),
                    conditionalValueIndex: 0,
                    configRowIndex: 0,
                    selectedValue: {
                      int: 42,
                    },
                    count: Long.fromNumber(1),
                    reason: 0,
                  },
                ],
              },
            ],
          },
        },
      ],
    });

    expect(aggregator.data).toStrictEqual(new Map());
  });

  it("won't add data past the maxDataSize", () => {
    const aggregator = evaluationSummaries(
      mockApiClient,
      instanceHash,
      true,
      2
    );

    aggregator.push(evaluationFor(propIsOneOf, usContexts));
    aggregator.push(evaluationFor(basicConfig, usContexts));
    aggregator.push(evaluationFor(rolloutFlag, usContexts));

    expect(aggregator.data.size).toEqual(2);
  });

  describe("integration tests", () => {
    it("records evaluation summaries by default", () => {
      const prefab = new Prefab({
        apiKey: irrelevant,
      });
      prefab.setConfig([basicConfig], projectEnvIdUnderTest, new Map());

      prefab.get("basic.value", usContexts);

      expect(prefab.telemetry.evaluationSummaries.data).toStrictEqual(
        new Map([
          ['["basic.value","1"]', new Map([['["999",0,0,"int",42,null]', 1]])],
        ])
      );
    });

    it("does not record evaluation summaries when collectEvaluationSummaries is false", () => {
      const prefab = new Prefab({
        apiKey: irrelevant,
        collectEvaluationSummaries: false,
      });
      prefab.setConfig([basicConfig], projectEnvIdUnderTest, new Map());

      prefab.get("basic.value", usContexts);

      expect(prefab.telemetry.evaluationSummaries.data).toStrictEqual(
        new Map()
      );
    });
  });
});
