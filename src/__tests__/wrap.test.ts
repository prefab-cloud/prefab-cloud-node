import { valueType, wrap } from "../wrap"; // Update with the correct path to your module

describe("valueType", () => {
  it('should return "int" for integer values', () => {
    expect(valueType(42)).toBe("int");
    expect(valueType(-10)).toBe("int");
    expect(valueType(0)).toBe("int");
  });

  it('should return "double" for decimal number values', () => {
    expect(valueType(3.14)).toBe("double");
    expect(valueType(-0.5)).toBe("double");
  });

  it('should return "bool" for boolean values', () => {
    expect(valueType(true)).toBe("bool");
    expect(valueType(false)).toBe("bool");
  });

  it('should return "stringList" for array values', () => {
    expect(valueType(["apple", "banana"])).toBe("stringList");
    expect(valueType([])).toBe("stringList");
  });

  it('should return "string" for other values', () => {
    expect(valueType("hello")).toBe("string");
    expect(valueType({})).toBe("string");
    expect(valueType(null)).toBe("string");
    expect(valueType(undefined)).toBe("string");
  });
});

describe("wrap", () => {
  it("should wrap values with the appropriate key", () => {
    expect(wrap(42)).toEqual({ int: 42 });
    expect(wrap(3.14)).toEqual({ double: 3.14 });
    expect(wrap(true)).toEqual({ bool: true });
    expect(wrap(["apple", "banana"])).toEqual({
      stringList: {
        values: ["apple", "banana"],
      },
    });
    expect(wrap("hello")).toEqual({ string: "hello" });
  });
});
