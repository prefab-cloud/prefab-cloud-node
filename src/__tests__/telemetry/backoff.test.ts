import { Backoff } from "../../telemetry/backoff";

describe("Backoff", () => {
  it("grows until it reaches the limit", () => {
    const backoff = new Backoff({ maxDelay: 64 });

    expect(backoff.call()).toBe(2);
    expect(backoff.call()).toBe(4);
    expect(backoff.call()).toBe(8);
    expect(backoff.call()).toBe(16);
    expect(backoff.call()).toBe(32);
    expect(backoff.call()).toBe(64);
    expect(backoff.call()).toBe(64); // Max delay reached
  });

  it("can start with an initial delay", () => {
    const backoff = new Backoff({ maxDelay: 32, initialDelay: 10 });
    expect(backoff.call()).toBe(10);
    expect(backoff.call()).toBe(20);
    expect(backoff.call()).toBe(32); // Not a multiple of 10 but that's fine
    expect(backoff.call()).toBe(32); // Max delay reached
  });
});
