import type { Config } from "../proto";
import { ConfigType, LogLevel, Criterion_CriterionOperator } from "../proto";
import { Resolver } from "../resolver";
import { shouldLog, wordLevelToNumber, PREFIX } from "../logger";
import { irrelevantLong, projectEnvIdUnderTest } from "./testHelpers";

const getResolver = (configs: Config[]): Resolver => {
  return new Resolver(
    configs,
    projectEnvIdUnderTest,
    "some-namespace",
    "error",
    LogLevel.WARN
  );
};

const levelAt = (path: string, level: string): Config => {
  return {
    id: irrelevantLong,
    projectId: irrelevantLong,
    key: `${PREFIX}${path}`,
    changedBy: undefined,
    rows: [
      {
        properties: {},
        values: [
          {
            criteria: [],
            value: {
              logLevel: wordLevelToNumber(level),
            },
          },
        ],
      },
    ],
    allowableValues: [],
    configType: ConfigType.LOG_LEVEL,
    draftId: irrelevantLong,
  };
};

const examples: Array<[string, string, boolean]> = [
  ["trace", "trace", true],
  ["trace", "debug", true],
  ["trace", "info", true],
  ["trace", "warn", true],
  ["trace", "error", true],
  ["trace", "fatal", true],

  ["debug", "trace", false],
  ["debug", "debug", true],
  ["debug", "info", true],
  ["debug", "warn", true],
  ["debug", "error", true],
  ["debug", "fatal", true],

  ["info", "trace", false],
  ["info", "debug", false],
  ["info", "info", true],
  ["info", "warn", true],
  ["info", "error", true],
  ["info", "fatal", true],

  ["warn", "trace", false],
  ["warn", "debug", false],
  ["warn", "info", false],
  ["warn", "warn", true],
  ["warn", "error", true],
  ["warn", "fatal", true],

  ["error", "trace", false],
  ["error", "debug", false],
  ["error", "info", false],
  ["error", "warn", false],
  ["error", "error", true],
  ["error", "fatal", true],

  ["fatal", "trace", false],
  ["fatal", "debug", false],
  ["fatal", "info", false],
  ["fatal", "warn", false],
  ["fatal", "error", false],
  ["fatal", "fatal", true],
];

describe("shouldLog", () => {
  it("returns true if the resolved level is greater than or equal to the desired level", () => {
    const loggerName = "noDotsHere";
    const resolver = getResolver([levelAt(loggerName, "trace")]);

    expect(
      shouldLog({
        loggerName,
        desiredLevel: LogLevel.TRACE,
        resolver,
        defaultLevel: 5,
      })
    ).toEqual(true);
  });

  examples.forEach(([ruleLevel, desiredLevel, expected]) => {
    it(`returns ${expected.toString()} if the resolved level is ${ruleLevel} and the desired level is ${desiredLevel}`, () => {
      const loggerName = "some.test.name";
      const resolver = getResolver([levelAt(loggerName, ruleLevel)]);
      expect(
        shouldLog({
          loggerName,
          desiredLevel: wordLevelToNumber(desiredLevel),
          resolver,
          defaultLevel: LogLevel.WARN,
        })
      ).toEqual(expected);
    });
  });

  it("traverses the hierarchy to get the closest level for the loggerName", () => {
    const loggerName = "some.test.name.with.more.levels";
    const resolver = getResolver([
      levelAt("some.test.name", "trace"),
      levelAt("some.test", "debug"),
      levelAt("irrelevant", "error"),
    ]);

    expect(
      shouldLog({ loggerName, desiredLevel: LogLevel.TRACE, resolver })
    ).toEqual(true);

    expect(
      shouldLog({
        loggerName: "some.test",
        desiredLevel: LogLevel.TRACE,
        resolver,
      })
    ).toEqual(false);

    expect(
      shouldLog({
        loggerName: "some.test",
        desiredLevel: LogLevel.DEBUG,
        resolver,
      })
    ).toEqual(true);

    expect(
      shouldLog({
        loggerName: "some.test",
        desiredLevel: LogLevel.INFO,
        resolver,
      })
    ).toEqual(true);
  });

  it("considers context", () => {
    const loggerName = "some.test.name";

    const config = {
      id: irrelevantLong,
      projectId: irrelevantLong,
      key: `${PREFIX}${loggerName}`,
      changedBy: undefined,
      rows: [
        {
          properties: {},
          projectEnvId: projectEnvIdUnderTest,
          values: [
            {
              criteria: [
                {
                  propertyName: "user.country",
                  operator: Criterion_CriterionOperator.PROP_IS_ONE_OF,
                  valueToMatch: {
                    stringList: {
                      values: ["US", "UK"],
                    },
                  },
                },
              ],
              value: {
                logLevel: LogLevel.INFO,
              },
            },
            {
              criteria: [],
              value: {
                logLevel: LogLevel.WARN,
              },
            },
          ],
        },
      ],
      allowableValues: [],
      configType: ConfigType.LOG_LEVEL,
      draftId: irrelevantLong,
    };

    const resolver = getResolver([config]);

    // without context
    expect(
      shouldLog({
        loggerName: "some.test.name.here",
        desiredLevel: LogLevel.INFO,
        resolver,
        contexts: new Map(),
      })
    ).toEqual(false);

    // with non-matching context
    expect(
      shouldLog({
        loggerName: "some.test.name.here",
        desiredLevel: LogLevel.INFO,
        resolver,
        contexts: new Map().set("user", new Map().set("country", "CA")),
      })
    ).toEqual(false);

    // with matching context
    expect(
      shouldLog({
        loggerName: "some.test.name.here",
        desiredLevel: LogLevel.INFO,
        resolver,
        contexts: new Map().set("user", new Map().set("country", "US")),
      })
    ).toEqual(true);
  });

  it("returns the default level provided if there is no match", () => {
    const resolver = getResolver([levelAt("irrelevant", "error")]);
    const loggerName = "a.b.c.d";

    expect(
      shouldLog({
        loggerName,
        desiredLevel: LogLevel.DEBUG,
        defaultLevel: LogLevel.TRACE,
        resolver,
      })
    ).toEqual(true);

    expect(
      shouldLog({
        loggerName,
        desiredLevel: LogLevel.DEBUG,
        defaultLevel: LogLevel.DEBUG,
        resolver,
      })
    ).toEqual(true);

    expect(
      shouldLog({
        loggerName,
        desiredLevel: LogLevel.DEBUG,
        defaultLevel: LogLevel.INFO,
        resolver,
      })
    ).toEqual(false);
  });
});

describe("wordLevelToNumber", () => {
  it("turns a string level into a number", () => {
    expect(wordLevelToNumber("trace")).toEqual(1);
    expect(wordLevelToNumber("debug")).toEqual(2);
    expect(wordLevelToNumber("info")).toEqual(3);
    expect(wordLevelToNumber("warn")).toEqual(5);
    expect(wordLevelToNumber("error")).toEqual(6);
    expect(wordLevelToNumber("fatal")).toEqual(9);
  });

  it("returns a too-high number to match anything for unrecognized levels", () => {
    expect(wordLevelToNumber("something-else")).toEqual(Infinity);
  });
});
