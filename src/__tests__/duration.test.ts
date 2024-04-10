import { durationToMilliseconds } from "../duration";

const MINUTES_IN_SECONDS = 60;
const HOURS_IN_SECONDS = 60 * MINUTES_IN_SECONDS;
const DAYS_IN_SECONDS = 24 * HOURS_IN_SECONDS;

describe("durationToMilliseconds", () => {
  const tests: Array<[string, number]> = [
    ["PT0M0S", 0],
    ["PT6M", 6 * MINUTES_IN_SECONDS],
    ["PT90S", 90],
    ["P1D", DAYS_IN_SECONDS],
    ["PT1.5M", 1.5 * MINUTES_IN_SECONDS],
    ["P0.75D", 0.75 * DAYS_IN_SECONDS],
    ["PT1M90.3S", MINUTES_IN_SECONDS + 90.3],
    ["PT1H", HOURS_IN_SECONDS],
    ["PT1.3H", 1.3 * HOURS_IN_SECONDS],
    ["P1.5DT1.5M", 1.5 * DAYS_IN_SECONDS + MINUTES_IN_SECONDS * 1.5],
    [
      "P1.5DT1.5H1.5M",
      1.5 * DAYS_IN_SECONDS + 1.5 * HOURS_IN_SECONDS + MINUTES_IN_SECONDS * 1.5,
    ],
    [
      "P1.5DT1.5H1.5M3.5S",
      1.5 * DAYS_IN_SECONDS +
        1.5 * HOURS_IN_SECONDS +
        MINUTES_IN_SECONDS * 1.5 +
        3.5,
    ],
    [
      "P1DT2H3M4S",
      DAYS_IN_SECONDS + 2 * HOURS_IN_SECONDS + 3 * MINUTES_IN_SECONDS + 4,
    ],
    ["PT1H30M", HOURS_IN_SECONDS + 30 * MINUTES_IN_SECONDS],
    ["P0.5DT0.25H", 0.5 * DAYS_IN_SECONDS + 0.25 * HOURS_IN_SECONDS],
    ["PT15M30S", 15 * MINUTES_IN_SECONDS + 30],
    ["PT0.000347222H", 0.000347222 * HOURS_IN_SECONDS],
    ["PT23H59M59S", 23 * HOURS_IN_SECONDS + 59 * MINUTES_IN_SECONDS + 59],
    ["P0.25DT3.75H", 0.25 * DAYS_IN_SECONDS + 3.75 * HOURS_IN_SECONDS],
  ];

  tests.forEach(([duration, expectedSeconds]) => {
    const expectedMilliseconds = expectedSeconds * 1000;

    it(`should convert ${duration} to ${expectedMilliseconds}ms`, () => {
      expect(durationToMilliseconds(duration)).toBe(expectedMilliseconds);
    });
  });
});
