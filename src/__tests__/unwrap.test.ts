import {
  unwrap,
  unwrapPrimitive,
  unwrapValue,
  NULL_UNWRAPPED_VALUE,
  TRUE_VALUES,
} from "../unwrap";
import { Config_ValueType, ProvidedSource } from "../proto";
import type { ConfigValue, Config } from "../proto";
import Long from "long";

const key = "some.key";
const emptyHashByPropertyValue = undefined;

describe("unwrapValue", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return the string value", () => {
    [true, false].forEach((primitivesOnly) => {
      const value: ConfigValue = { string: "test" };
      expect(
        unwrapValue({
          key,
          kind: "string",
          value,
          hashByPropertyValue: emptyHashByPropertyValue,
          primitivesOnly,
        })
      ).toStrictEqual({ value: "test" });
    });
  });

  it("should return the int value as a number", () => {
    [true, false].forEach((primitivesOnly) => {
      const value: ConfigValue = { int: Long.fromInt(42) };
      expect(
        unwrapValue({
          key,
          kind: "int",
          value,
          hashByPropertyValue: emptyHashByPropertyValue,
          primitivesOnly,
        })
      ).toStrictEqual({ value: 42 });
    });
  });

  it("should return the bool value", () => {
    [true, false].forEach((primitivesOnly) => {
      const value: ConfigValue = { bool: true };
      expect(
        unwrapValue({
          key,
          kind: "bool",
          value,
          hashByPropertyValue: emptyHashByPropertyValue,
          primitivesOnly,
        })
      ).toStrictEqual({ value: true });
    });
  });

  it("should return the stringList values as an array", () => {
    [true, false].forEach((primitivesOnly) => {
      const value: ConfigValue = { stringList: { values: ["a", "b", "c"] } };
      expect(
        unwrapValue({
          key,
          kind: "stringList",
          value,
          hashByPropertyValue: emptyHashByPropertyValue,
          primitivesOnly,
        })
      ).toStrictEqual({ value: ["a", "b", "c"] });
    });
  });

  it("should unwrap a json value", () => {
    [true, false].forEach((primitivesOnly) => {
      const value: ConfigValue = {
        json: { json: JSON.stringify({ a: 1, b: 2 }) },
      };
      expect(
        unwrapValue({
          key,
          kind: "json",
          value,
          hashByPropertyValue: emptyHashByPropertyValue,
          primitivesOnly,
        })
      ).toStrictEqual({ value: { a: 1, b: 2 } });
    });
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

    const args = {
      key,
      kind: "string" as const,
      value,
      hashByPropertyValue: emptyHashByPropertyValue,
      primitivesOnly: false,
    };

    jest.spyOn(global.Math, "random").mockReturnValue(0.5);
    expect(unwrapValue(args)).toEqual({ value: "b", index: 1 });

    jest.spyOn(global.Math, "random").mockReturnValue(0.1);
    expect(unwrapValue(args)).toEqual({ value: "a", index: 0 });

    jest.spyOn(global.Math, "random").mockReturnValue(0.8);
    expect(unwrapValue(args)).toEqual({ value: "c", index: 2 });
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

    const args = (
      hashByPropertyValue: string
    ): Parameters<typeof unwrapValue>[0] => ({
      key,
      kind: "string" as const,
      value,
      hashByPropertyValue,
      primitivesOnly: false,
    });

    expect(unwrapValue(args("100"))).toEqual({ value: "a", index: 0 });
    expect(unwrapValue(args("110"))).toEqual({ value: "b", index: 1 });
    expect(unwrapValue(args("101"))).toEqual({ value: "c", index: 2 });
  });

  it("can unwrap a provided string", () => {
    const value = {
      provided: { lookup: "MY_ENV_VAR", source: ProvidedSource.ENV_VAR },
    };

    process.env["MY_ENV_VAR"] = "test";

    expect(
      unwrapValue({
        key,
        kind: "string",
        value,
        hashByPropertyValue: emptyHashByPropertyValue,
        primitivesOnly: false,
        config: { valueType: Config_ValueType.STRING } as unknown as Config,
      })
    ).toStrictEqual({ value: "test" });
  });

  it("can unwrap a provided int", () => {
    const value = {
      provided: { lookup: "MY_ENV_VAR", source: ProvidedSource.ENV_VAR },
    };

    process.env["MY_ENV_VAR"] = "90210";

    expect(
      unwrapValue({
        key,
        kind: "string",
        value,
        hashByPropertyValue: emptyHashByPropertyValue,
        primitivesOnly: false,
        config: { valueType: Config_ValueType.INT } as unknown as Config,
      })
    ).toStrictEqual({ value: 90210 });
  });

  it("can unwrap a provided double", () => {
    const value = {
      provided: { lookup: "MY_ENV_VAR", source: ProvidedSource.ENV_VAR },
    };

    process.env["MY_ENV_VAR"] = "3.14159265359";

    expect(
      unwrapValue({
        key,
        kind: "string",
        value,
        hashByPropertyValue: emptyHashByPropertyValue,
        primitivesOnly: false,
        config: { valueType: Config_ValueType.DOUBLE } as unknown as Config,
      })
    ).toStrictEqual({ value: 3.14159265359 });
  });

  it("can unwrap a provided bool", () => {
    const value = {
      provided: { lookup: "MY_ENV_VAR", source: ProvidedSource.ENV_VAR },
    };

    TRUE_VALUES.forEach((trueValue) => {
      process.env["MY_ENV_VAR"] = trueValue;

      expect(
        unwrapValue({
          key,
          kind: "string",
          value,
          hashByPropertyValue: emptyHashByPropertyValue,
          primitivesOnly: false,
          config: { valueType: Config_ValueType.BOOL } as unknown as Config,
        })
      ).toStrictEqual({ value: true });
    });

    ["false", "0", "f", "no", "🤡"].forEach((falseValue) => {
      process.env["MY_ENV_VAR"] = falseValue;

      expect(
        unwrapValue({
          key,
          kind: "string",
          value,
          hashByPropertyValue: emptyHashByPropertyValue,
          primitivesOnly: false,
          config: { valueType: Config_ValueType.BOOL } as unknown as Config,
        })
      ).toStrictEqual({ value: false });
    });
  });

  it("can unwrap a provided stringList", () => {
    const value = {
      provided: { lookup: "MY_ENV_VAR", source: ProvidedSource.ENV_VAR },
    };

    ["a,b,c", "a, b, c", "a , b , c"].forEach((stringValue) => {
      process.env["MY_ENV_VAR"] = stringValue;

      expect(
        unwrapValue({
          key,
          kind: "string",
          value,
          hashByPropertyValue: emptyHashByPropertyValue,
          primitivesOnly: false,
          config: {
            valueType: Config_ValueType.STRING_LIST,
          } as unknown as Config,
        })
      ).toStrictEqual({ value: ["a", "b", "c"] });
    });
    process.env["MY_ENV_VAR"] = "test";

    expect(
      unwrapValue({
        key,
        kind: "string",
        value,
        hashByPropertyValue: emptyHashByPropertyValue,
        primitivesOnly: false,
        config: { valueType: Config_ValueType.STRING } as unknown as Config,
      })
    ).toStrictEqual({ value: "test" });
  });
});

describe("unwrap", () => {
  it("should throw an error for unexpected values", () => {
    const value: ConfigValue = { bytes: Buffer.from("test") };
    expect(() =>
      unwrap({
        key,
        value,
      })
    ).toThrowError("Unexpected value");
  });

  it("should return undefined for undefined input", () => {
    expect(
      unwrap({
        key,
        value: undefined,
        hashByPropertyValue: emptyHashByPropertyValue,
      })
    ).toStrictEqual(NULL_UNWRAPPED_VALUE);
  });

  it("should return the value from unwrapValue for non-undefined input", () => {
    const value: ConfigValue = { string: "test" };
    expect(
      unwrap({ key, value, hashByPropertyValue: emptyHashByPropertyValue })
    ).toStrictEqual({ value: "test", reportableValue: undefined });
  });
});

describe("unwrapPrimitive", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return undefined for undefined input", () => {
    expect(unwrapPrimitive(key, undefined)).toStrictEqual(NULL_UNWRAPPED_VALUE);
  });

  it("should return the value from unwrapValue for non-undefined input", () => {
    const value: ConfigValue = { string: "test" };
    expect(unwrapPrimitive(key, value)).toStrictEqual({
      value: "test",
      reportableValue: undefined,
    });
  });

  it("should return undefined from unwrapValue for non-primitive input", () => {
    const value: ConfigValue = {
      provided: {
        lookup: "MY_ENV_VAR",
        source: ProvidedSource.ENV_VAR,
      },
    };
    expect(unwrapPrimitive(key, value)).toStrictEqual(NULL_UNWRAPPED_VALUE);

    expect(jest.mocked(console.error)).toHaveBeenCalledTimes(1);
    expect(jest.mocked(console.error)).toHaveBeenCalledWith(
      'Unexpected value {"provided":{"lookup":"MY_ENV_VAR","source":1}} in primitivesOnly mode'
    );
  });
});
