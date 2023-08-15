import { Prefab } from "../../prefab";
import { contextShapes, stub } from "../../telemetry/contextShapes";
import type { Contexts } from "../../types";
import {
  mockApiClient,
  irrelevant,
  projectEnvIdUnderTest,
} from "../testHelpers";
import basicConfig from "../fixtures/basicConfig";

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

describe("contextShapes", () => {
  it("returns stub if contextUploadMode is not shapeOnly", () => {
    expect(contextShapes(mockApiClient, "periodicExample")).toBe(stub);
    expect(contextShapes(mockApiClient, "none")).toBe(stub);
  });

  it("pushes data", () => {
    const aggregator = contextShapes(mockApiClient, "shapeOnly");

    const contexts: Contexts = new Map([
      ["user", userContext],
      ["team", teamContext],
    ]);

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
    const aggregator = contextShapes(mockApiClient, "shapeOnly");

    const contexts: Contexts = new Map([
      ["user", userContext],
      ["team", teamContext],
    ]);

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
      prefab.setConfig([basicConfig], projectEnvIdUnderTest);

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

    it("does not record context shapes by default", () => {
      const prefabWithoutShapes = new Prefab({
        apiKey: irrelevant,
      });
      prefabWithoutShapes.setConfig([basicConfig], projectEnvIdUnderTest);

      prefabWithoutShapes.get("basic.value", contexts);

      expect(prefabWithoutShapes.telemetry.contextShapes.data).toStrictEqual(
        new Map()
      );
    });
  });
});
