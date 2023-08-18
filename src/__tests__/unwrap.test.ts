import { unwrap, unwrapValue } from "../unwrap";
import type { ConfigValue } from "../proto";
import Long from "long";

const key = "some.key";
const emptyHashByPropertyValue = undefined;

describe("unwrapValue", () => {
  afterEach(() => {
    jest.spyOn(global.Math, "random").mockRestore();
  });

  it("should return the string value", () => {
    const value: ConfigValue = { string: "test" };
    expect(unwrapValue(key, value, emptyHashByPropertyValue)).toStrictEqual([
      "test",
      undefined,
    ]);
  });

  it("should return the int value as a number", () => {
    const value: ConfigValue = { int: Long.fromInt(42) };
    expect(unwrapValue(key, value, emptyHashByPropertyValue)).toStrictEqual([
      42,
      undefined,
    ]);
  });

  it("should return the bool value", () => {
    const value: ConfigValue = { bool: true };
    expect(unwrapValue(key, value, emptyHashByPropertyValue)).toStrictEqual([
      true,
      undefined,
    ]);
  });

  it("should return the stringList values as an array", () => {
    const value: ConfigValue = { stringList: { values: ["a", "b", "c"] } };
    expect(unwrapValue(key, value, emptyHashByPropertyValue)).toStrictEqual([
      ["a", "b", "c"],
      undefined,
    ]);
  });

  it("should return a random weighted value with no context", () => {
    const value: ConfigValue = {
      weightedValues: {
        weightedValues: [
          { value: { string: "a" }, weight: 1 },
          { value: { string: "b" }, weight: 1 },
          { value: { string: "c" }, weight: 1 },
        ],
      },
    };

    jest.spyOn(global.Math, "random").mockReturnValue(0.5);
    expect(unwrapValue(key, value, emptyHashByPropertyValue)).toEqual(["b", 1]);

    jest.spyOn(global.Math, "random").mockReturnValue(0.1);
    expect(unwrapValue(key, value, emptyHashByPropertyValue)).toEqual(["a", 0]);

    jest.spyOn(global.Math, "random").mockReturnValue(0.8);
    expect(unwrapValue(key, value, emptyHashByPropertyValue)).toEqual(["c", 2]);
  });

  it("should return a consistent weighted value with context", () => {
    const value: ConfigValue = {
      weightedValues: {
        weightedValues: [
          { value: { string: "a" }, weight: 1 },
          { value: { string: "b" }, weight: 1 },
          { value: { string: "c" }, weight: 1 },
        ],
      },
    };

    expect(unwrapValue(key, value, "100")).toEqual(["a", 0]);
    expect(unwrapValue(key, value, "110")).toEqual(["b", 1]);
    expect(unwrapValue(key, value, "101")).toEqual(["c", 2]);
  });

  it("should throw an error for unexpected values", () => {
    const value: ConfigValue = { bytes: Buffer.from("test") };
    expect(() =>
      unwrapValue(key, value, emptyHashByPropertyValue)
    ).toThrowError("Unexpected value");
  });
});

describe("unwrap", () => {
  it("should return undefined for undefined input", () => {
    expect(unwrap(key, undefined, emptyHashByPropertyValue)).toStrictEqual([
      undefined,
      undefined,
    ]);
  });

  it("should return the value from unwrapValue for non-undefined input", () => {
    const value: ConfigValue = { string: "test" };
    expect(unwrap(key, value, emptyHashByPropertyValue)).toStrictEqual([
      "test",
      undefined,
    ]);
  });
});
