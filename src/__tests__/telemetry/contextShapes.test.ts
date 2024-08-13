import { Prefab } from "../../prefab";
import { contextShapes, stub } from "../../telemetry/contextShapes";
import type { Contexts } from "../../types";
import {
  mockApiClient,
  irrelevant,
  projectEnvIdUnderTest,
} from "../testHelpers";
import basicConfig from "../fixtures/basicConfig";

const frContexts = new Map([["user", new Map([["country", "FR"]])]]);

const userContext = new Map<string, any>([
  ["key", "abc"],
  ["email", "test@example.com"],
  ["activated", true],
  ["age", 12],
  ["shoeSize", 11.5],
  ["someArray", [1, 2, 3, 4]],
]);

const teamContext = new Map<string, any>([
  ["key", "team-123"],
  ["size", 9],
]);

const contexts: Contexts = new Map([
  ["user", userContext],
  ["team", teamContext],
]);

const telemetrySource = "https://telemetry.example.com";

describe("contextShapes", () => {
  it("returns stub if contextUploadMode is not `none`", () => {
    expect(contextShapes(mockApiClient, telemetrySource, "shapeOnly")).not.toBe(
      stub
    );
    expect(
      contextShapes(mockApiClient, telemetrySource, "periodicExample")
    ).not.toBe(stub);
    expect(contextShapes(mockApiClient, telemetrySource, "none")).toBe(stub);
  });

  it("pushes data", () => {
    const aggregator = contextShapes(
      mockApiClient,
      telemetrySource,
      "shapeOnly"
    );

    aggregator.push(contexts);

    expect(Object.fromEntries(aggregator.data)).toStrictEqual({
      team: {
        key: 2,
        size: 1,
      },
      user: {
        key: 2,
        email: 2,
        activated: 5,
        age: 1,
        shoeSize: 4,
        someArray: 10,
      },
    });
  });

  it("should sync context shapes to the server", async () => {
    const aggregator = contextShapes(
      mockApiClient,
      telemetrySource,
      "shapeOnly"
    );

    aggregator.push(contexts);

    const syncResult = await aggregator.sync();

    expect(mockApiClient.fetch).toHaveBeenCalled();

    expect(syncResult).toStrictEqual({
      status: 200,
      dataSent: {
        shapes: [
          {
            name: "user",
            fieldTypes: {
              key: 2,
              email: 2,
              activated: 5,
              age: 1,
              shoeSize: 4,
              someArray: 10,
            },
          },
          { name: "team", fieldTypes: { key: 2, size: 1 } },
        ],
      },
    });

    expect(aggregator.data).toStrictEqual(new Map());
  });

  it("won't add data past the maxDataSize", () => {
    const aggregator = contextShapes(
      mockApiClient,
      telemetrySource,
      "shapeOnly",
      undefined,
      2
    );

    aggregator.push(contexts);

    expect(Object.fromEntries(aggregator.data)).toStrictEqual({
      team: {
        key: 2,
        size: 1,
      },
      user: {
        activated: 5,
        age: 1,
        email: 2,
        key: 2,
        shoeSize: 4,
        someArray: 10,
      },
    });

    aggregator.push(frContexts);
    aggregator.push(new Map([["org", new Map([["favoriteSandwich", "BLT"]])]]));

    expect(Object.fromEntries(aggregator.data)).toStrictEqual({
      team: {
        key: 2,
        size: 1,
      },
      user: {
        activated: 5,
        age: 1,
        country: 2, // from frContexts
        email: 2,
        key: 2,
        shoeSize: 4,
        someArray: 10,
      },
    });
  });

  describe("integration tests", () => {
    const contexts = new Map([
      [
        "user",
        new Map<string, any>([
          ["key", "abc"],
          ["randomNumber", 100],
        ]),
      ],
    ]);

    it("records context shapes when contextUploadMode=shapeOnly", () => {
      const prefab = new Prefab({
        apiKey: irrelevant,
        contextUploadMode: "shapeOnly",
      });
      prefab.setConfig([basicConfig], projectEnvIdUnderTest, new Map());

      prefab.get("basic.value", contexts);

      expect(prefab.telemetry.contextShapes.data).toStrictEqual(
        new Map(
          Object.entries({
            user: {
              key: 2,
              randomNumber: 1,
            },
          })
        )
      );
    });

    it("records context shapes by default", () => {
      const prefabWithoutShapes = new Prefab({
        apiKey: irrelevant,
      });
      prefabWithoutShapes.setConfig(
        [basicConfig],
        projectEnvIdUnderTest,
        new Map()
      );

      prefabWithoutShapes.get("basic.value", contexts);

      expect(prefabWithoutShapes.telemetry.contextShapes.data).toStrictEqual(
        new Map(
          Object.entries({
            user: {
              key: 2,
              randomNumber: 1,
            },
          })
        )
      );
    });
  });
});
