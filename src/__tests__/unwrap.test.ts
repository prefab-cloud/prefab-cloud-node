import { unwrap, unwrapPrimitive, unwrapValue, TRUE_VALUES } from "../unwrap";
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
          value,
          hashByPropertyValue: emptyHashByPropertyValue,
          primitivesOnly,
        })
      ).toStrictEqual(["test", undefined]);
    });
  });

  it("should return the int value as a number", () => {
    [true, false].forEach((primitivesOnly) => {
      const value: ConfigValue = { int: Long.fromInt(42) };
      expect(
        unwrapValue({
          key,
          value,
          hashByPropertyValue: emptyHashByPropertyValue,
          primitivesOnly,
        })
      ).toStrictEqual([42, undefined]);
    });
  });

  it("should return the bool value", () => {
    [true, false].forEach((primitivesOnly) => {
      const value: ConfigValue = { bool: true };
      expect(
        unwrapValue({
          key,
          value,
          hashByPropertyValue: emptyHashByPropertyValue,
          primitivesOnly,
        })
      ).toStrictEqual([true, undefined]);
    });
  });

  it("should return the stringList values as an array", () => {
    [true, false].forEach((primitivesOnly) => {
      const value: ConfigValue = { stringList: { values: ["a", "b", "c"] } };
      expect(
        unwrapValue({
          key,
          value,
          hashByPropertyValue: emptyHashByPropertyValue,
          primitivesOnly,
        })
      ).toStrictEqual([["a", "b", "c"], undefined]);
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
      value,
      hashByPropertyValue: emptyHashByPropertyValue,
      primitivesOnly: false,
    };

    jest.spyOn(global.Math, "random").mockReturnValue(0.5);
    expect(unwrapValue(args)).toEqual(["b", 1]);

    jest.spyOn(global.Math, "random").mockReturnValue(0.1);
    expect(unwrapValue(args)).toEqual(["a", 0]);

    jest.spyOn(global.Math, "random").mockReturnValue(0.8);
    expect(unwrapValue(args)).toEqual(["c", 2]);
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
      value,
      hashByPropertyValue,
      primitivesOnly: false,
    });

    expect(unwrapValue(args("100"))).toEqual(["a", 0]);
    expect(unwrapValue(args("110"))).toEqual(["b", 1]);
    expect(unwrapValue(args("101"))).toEqual(["c", 2]);
  });

  it("can unwrap a provided string", () => {
    const value = {
      provided: { lookup: "MY_ENV_VAR", source: ProvidedSource.ENV_VAR },
    };

    process.env["MY_ENV_VAR"] = "test";

    expect(
      unwrapValue({
        key,
        value,
        hashByPropertyValue: emptyHashByPropertyValue,
        primitivesOnly: false,
        config: { valueType: Config_ValueType.STRING } as unknown as Config,
      })
    ).toStrictEqual(["test", undefined]);
  });

  it("can unwrap a provided int", () => {
    const value = {
      provided: { lookup: "MY_ENV_VAR", source: ProvidedSource.ENV_VAR },
    };

    process.env["MY_ENV_VAR"] = "90210";

    expect(
      unwrapValue({
        key,
        value,
        hashByPropertyValue: emptyHashByPropertyValue,
        primitivesOnly: false,
        config: { valueType: Config_ValueType.INT } as unknown as Config,
      })
    ).toStrictEqual([90210, undefined]);
  });

  it("can unwrap a provided double", () => {
    const value = {
      provided: { lookup: "MY_ENV_VAR", source: ProvidedSource.ENV_VAR },
    };

    process.env["MY_ENV_VAR"] = "3.14159265359";

    expect(
      unwrapValue({
        key,
        value,
        hashByPropertyValue: emptyHashByPropertyValue,
        primitivesOnly: false,
        config: { valueType: Config_ValueType.DOUBLE } as unknown as Config,
      })
    ).toStrictEqual([3.14159265359, undefined]);
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
          value,
          hashByPropertyValue: emptyHashByPropertyValue,
          primitivesOnly: false,
          config: { valueType: Config_ValueType.BOOL } as unknown as Config,
        })
      ).toStrictEqual([true, undefined]);
    });

    ["false", "0", "f", "no", "🤡"].forEach((falseValue) => {
      process.env["MY_ENV_VAR"] = falseValue;

      expect(
        unwrapValue({
          key,
          value,
          hashByPropertyValue: emptyHashByPropertyValue,
          primitivesOnly: false,
          config: { valueType: Config_ValueType.BOOL } as unknown as Config,
        })
      ).toStrictEqual([false, undefined]);
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
          value,
          hashByPropertyValue: emptyHashByPropertyValue,
          primitivesOnly: false,
          config: {
            valueType: Config_ValueType.STRING_LIST,
          } as unknown as Config,
        })
      ).toStrictEqual([["a", "b", "c"], undefined]);
    });
    process.env["MY_ENV_VAR"] = "test";

    expect(
      unwrapValue({
        key,
        value,
        hashByPropertyValue: emptyHashByPropertyValue,
        primitivesOnly: false,
        config: { valueType: Config_ValueType.STRING } as unknown as Config,
      })
    ).toStrictEqual(["test", undefined]);
  });

  it("should throw an error for unexpected values", () => {
    const value: ConfigValue = { bytes: Buffer.from("test") };
    expect(() =>
      unwrapValue({
        key,
        value,
        hashByPropertyValue: emptyHashByPropertyValue,
        primitivesOnly: false,
      })
    ).toThrowError("Unexpected value");
  });
});

describe("unwrap", () => {
  it("should return undefined for undefined input", () => {
    expect(
      unwrap({
        key,
        value: undefined,
        hashByPropertyValue: emptyHashByPropertyValue,
      })
    ).toStrictEqual([undefined, undefined]);
  });

  it("should return the value from unwrapValue for non-undefined input", () => {
    const value: ConfigValue = { string: "test" };
    expect(
      unwrap({ key, value, hashByPropertyValue: emptyHashByPropertyValue })
    ).toStrictEqual(["test", undefined]);
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
    expect(unwrapPrimitive(key, undefined)).toStrictEqual([
      undefined,
      undefined,
    ]);
  });

  it("should return the value from unwrapValue for non-undefined input", () => {
    const value: ConfigValue = { string: "test" };
    expect(unwrapPrimitive(key, value)).toStrictEqual(["test", undefined]);
  });

  it("should return undefined from unwrapValue for non-primitive input", () => {
    const value: ConfigValue = {
      provided: {
        lookup: "MY_ENV_VAR",
        source: ProvidedSource.ENV_VAR,
      },
    };
    expect(unwrapPrimitive(key, value)).toStrictEqual([undefined, undefined]);

    expect(jest.mocked(console.error)).toHaveBeenCalledTimes(1);
    expect(jest.mocked(console.error)).toHaveBeenCalledWith(
      'Unexpected value {"provided":{"lookup":"MY_ENV_VAR","source":1}} in primitivesOnly mode'
    );
  });
});
