import Long from "long";
import { Prefab } from "../../prefab";
import { exampleContexts, stub } from "../../telemetry/exampleContexts";
import type { Contexts } from "../../types";
import {
  mockApiClient,
  irrelevant,
  projectEnvIdUnderTest,
} from "../testHelpers";
import basicConfig from "../fixtures/basicConfig";

const instanceHash = "instance-hash";

const userContext = new Map<string, any>([
  ["key", "abc"],
  ["email", "test@example.com"],
  ["activated", true],
  ["age", 12],
  ["shoeSize", 11.5],
  ["someArray", [1, 2, 3, 4]],
  ["cars", ["Ford", "BMW", "Fiat"]],
]);

const teamContext = new Map<string, any>([
  ["key", "team-123"],
  ["size", 9],
]);

const contexts: Contexts = new Map([
  ["user", userContext],
  ["team", teamContext],
]);

describe("exampleContexts", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it("returns a stub if contextUploadMode is not periodicExample", () => {
    expect(exampleContexts(mockApiClient, instanceHash, "shapeOnly")).toBe(
      stub
    );
    expect(exampleContexts(mockApiClient, instanceHash, "none")).toBe(stub);
  });

  it("pushes data", () => {
    const initialTime = Date.now();

    const aggregator = exampleContexts(
      mockApiClient,
      instanceHash,
      "periodicExample"
    );

    const otherContexts: Contexts = new Map([
      ["user", new Map([["key", "def"]])],
    ]);

    aggregator.push(contexts);

    // The second push won't matter because we've cached this key for an hour
    aggregator.push(contexts);

    // But a context with a different key will be pushed
    aggregator.push(otherContexts);

    expect(aggregator.data).toStrictEqual([
      [initialTime, contexts],
      [initialTime, otherContexts],
    ]);

    // after some time passes, we can push again
    jest.advanceTimersByTime(60 * 60 * 1000 + 1);

    aggregator.push(contexts);

    expect(aggregator.data).toStrictEqual([
      [initialTime, contexts],
      [initialTime, otherContexts],
      [Date.now(), contexts],
    ]);
  });

  it("should sync to the server", async () => {
    const aggregator = exampleContexts(
      mockApiClient,
      instanceHash,
      "periodicExample"
    );

    if (!aggregator.enabled || aggregator.cache === undefined) {
      throw new Error("aggregator is not enabled");
    }

    aggregator.cache.prune = jest.fn();

    aggregator.push(contexts);

    const syncResult = await aggregator.sync();

    expect(mockApiClient.fetch).toHaveBeenCalled();

    expect(syncResult?.status).toEqual(200);

    expect(syncResult?.dataSent).toStrictEqual({
      instanceHash: "instance-hash",
      events: [
        {
          exampleContexts: {
            examples: [
              {
                timestamp: new Long(Date.now()),
                contextSet: {
                  contexts: [
                    {
                      type: "user",
                      values: {
                        key: {
                          string: "abc",
                        },
                        email: {
                          string: "test@example.com",
                        },
                        activated: {
                          bool: true,
                        },
                        age: {
                          int: 12,
                        },
                        shoeSize: {
                          double: 11.5,
                        },
                        someArray: {
                          stringList: { values: ["1", "2", "3", "4"] },
                        },
                        cars: {
                          stringList: { values: ["Ford", "BMW", "Fiat"] },
                        },
                      },
                    },
                    {
                      type: "team",
                      values: {
                        key: {
                          string: "team-123",
                        },
                        size: {
                          int: 9,
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    });

    expect(aggregator.data).toStrictEqual([]);

    expect(aggregator.cache.prune).toHaveBeenCalled();
  });

  it("won't add data past the maxDataSize", () => {
    const aggregator = exampleContexts(
      mockApiClient,
      instanceHash,
      "periodicExample",
      2
    );

    const orgContext = new Map([
      [
        "org",
        new Map([
          ["key", "def"],
          ["favoriteSandwich", "BLT"],
        ]),
      ],
    ]);

    const frContexts = new Map([
      [
        "user",
        new Map([
          ["trackingId", "hij"],
          ["country", "France"],
        ]),
      ],
    ]);

    aggregator.push(contexts);

    aggregator.push(orgContext);
    aggregator.push(frContexts);

    expect(aggregator.data).toStrictEqual([
      [Date.now(), contexts],
      [Date.now(), orgContext],
    ]);
  });

  describe("integration tests", () => {
    it("records context examples by default", () => {
      const prefab = new Prefab({
        apiKey: irrelevant,
      });
      prefab.setConfig([basicConfig], projectEnvIdUnderTest, new Map());

      prefab.get("basic.value", contexts);

      expect(prefab.telemetry.exampleContexts.data).toStrictEqual([
        [Date.now(), contexts],
      ]);
    });

    it("does not record context examples when contextUploadMode is not periodicExample", () => {
      const prefab = new Prefab({
        apiKey: irrelevant,
        contextUploadMode: "none",
      });
      prefab.setConfig([basicConfig], projectEnvIdUnderTest, new Map());

      prefab.get("basic.value", contexts);

      expect(prefab.telemetry.exampleContexts.data).toStrictEqual([]);
    });
  });
});
