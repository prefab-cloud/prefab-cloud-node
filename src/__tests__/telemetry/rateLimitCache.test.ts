import { rateLimitCache } from "../../telemetry/rateLimitCache";

describe("rateLimitCache", () => {
  const duration = 1000;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it("should return false for non-existent key", () => {
    const cache = rateLimitCache(duration);
    expect(cache.isFresh("nonexistent")).toBe(false);
  });

  it("should return true for a fresh key", () => {
    const cache = rateLimitCache(duration);
    cache.set("freshKey");
    expect(cache.isFresh("freshKey")).toBe(true);
  });

  it("should return false for an expired key", () => {
    const cache = rateLimitCache(duration);
    cache.set("expiredKey");
    jest.advanceTimersByTime(duration + 1);
    expect(cache.isFresh("expiredKey")).toBe(false);
  });

  it("should prune expired entries", () => {
    const cache = rateLimitCache(duration);
    cache.set("key1");
    cache.set("key2");

    jest.advanceTimersByTime(duration + 1);
    cache.prune();

    expect(cache.isFresh("key1")).toBe(false);
    expect(cache.isFresh("key2")).toBe(false);
  });

  it("should not prune fresh entries", () => {
    const cache = rateLimitCache(duration);
    cache.set("freshKey1");
    cache.set("freshKey2");

    cache.prune();

    expect(cache.isFresh("freshKey1")).toBe(true);
    expect(cache.isFresh("freshKey2")).toBe(true);
  });
});
