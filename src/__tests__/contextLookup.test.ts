import type { Contexts } from "../types";
import { contextLookup } from "../contextLookup";

describe("contextLookup", () => {
  let contexts: Contexts;

  beforeEach(() => {
    contexts = new Map([
      [
        "",
        new Map<string, any>([
          ["serverName", "John"],
          ["ttl", 30],
          ["isMobile", false],
        ]),
      ],
      [
        "custom",
        new Map<string, any>([
          ["serverName", "Jane"],
          ["ttl", 25],
          ["isMobile", true],
        ]),
      ],
    ]);
  });

  it("should return undefined when propertyName is undefined", () => {
    const result = contextLookup(contexts, undefined);
    expect(result).toBeUndefined();
  });

  it("should return undefined when propertyName is an empty string", () => {
    const result = contextLookup(contexts, "");
    expect(result).toBeUndefined();
  });

  it("should return undefined when propertyName does not contain a key", () => {
    const result = contextLookup(contexts, "default.");
    expect(result).toBeUndefined();
  });

  it("should return value from default context when propertyName does not contain a context serverName", () => {
    const result = contextLookup(contexts, "serverName");
    expect(result).toBe("John");
  });

  it("should return value from specified context", () => {
    const result = contextLookup(contexts, "custom.serverName");
    expect(result).toBe("Jane");
  });

  it("should return undefined when context does not exist", () => {
    const result = contextLookup(contexts, "nonexistent.serverName");
    expect(result).toBeUndefined();
  });

  it("should return undefined when key does not exist in the specified context", () => {
    const result = contextLookup(contexts, "custom.nonexistentKey");
    expect(result).toBeUndefined();
  });

  it("should return number value from default context when propertyName does not contain a context ttl", () => {
    const result = contextLookup(contexts, "ttl");
    expect(result).toBe(30);
  });

  it("should return number value from specified context", () => {
    const result = contextLookup(contexts, "custom.ttl");
    expect(result).toBe(25);
  });

  it("should return boolean value from default context when propertyName does not contain a context isMobile", () => {
    const result = contextLookup(contexts, "isMobile");
    expect(result).toBe(false);
  });

  it("should return boolean value from specified context", () => {
    const result = contextLookup(contexts, "custom.isMobile");
    expect(result).toBe(true);
  });

  it("should return current timestamp for prefab.current-time", () => {
    const result = contextLookup(contexts, "prefab.current-time");
    const now = +new Date();

    // Allow for a small time difference (within 100ms) since the test and the function call
    // might not execute at exactly the same millisecond
    expect(Math.abs((result as number) - now)).toBeLessThan(100);
  });
});
