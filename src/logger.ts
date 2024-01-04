import type { ContextObj, Contexts } from "./types";
import { type Resolver } from "./resolver";

export const PREFIX = "log-level.";

const validLogLevelNames = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
] as const;

export type ValidLogLevelName = (typeof validLogLevelNames)[number];

export type ValidLogLevel = 1 | 2 | 3 | 5 | 6 | 9;

const WORD_LEVEL_LOOKUP: Record<ValidLogLevelName, ValidLogLevel> = {
  trace: 1,
  debug: 2,
  info: 3,
  warn: 5,
  error: 6,
  fatal: 9,
};

export const wordLevelToNumber = (
  level: ValidLogLevelName
): ValidLogLevel | undefined => {
  return WORD_LEVEL_LOOKUP[level];
};

export const parseLevel = (
  level: ValidLogLevel | ValidLogLevelName | undefined
): ValidLogLevel | undefined => {
  if (typeof level === "number") {
    return level;
  }

  if (typeof level === "string") {
    return wordLevelToNumber(level);
  }

  return undefined;
};

export const shouldLog = ({
  loggerName,
  desiredLevel,
  defaultLevel,
  resolver,
  contexts,
}: {
  loggerName: string;
  desiredLevel: ValidLogLevel;
  defaultLevel: ValidLogLevel;
  resolver: Resolver;
  contexts?: Contexts | ContextObj;
}): boolean => {
  let loggerNameWithPrefix = PREFIX + loggerName;

  while (loggerNameWithPrefix.includes(".")) {
    const resolvedLevel = resolver.get(
      loggerNameWithPrefix,
      contexts,
      undefined,
      "ignore"
    );

    if (resolvedLevel !== undefined) {
      return Number(resolvedLevel) <= desiredLevel;
    }

    loggerNameWithPrefix = loggerNameWithPrefix.slice(
      0,
      loggerNameWithPrefix.lastIndexOf(".")
    );
  }

  return defaultLevel <= desiredLevel;
};

type MadeLogger = Record<
  ValidLogLevelName,
  (
    message: unknown,
    contexts?: Contexts | ContextObj | undefined
  ) => string | undefined
>;

export const makeLogger = ({
  loggerName,
  defaultLevel,
  resolver,
}: {
  loggerName: string;
  defaultLevel: ValidLogLevel;
  resolver: Resolver;
}): MadeLogger => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const logger = {} as MadeLogger;

  validLogLevelNames.forEach((levelName) => {
    const desiredLevel = parseLevel(levelName);

    if (desiredLevel === undefined) {
      throw new Error(`Invalid level: ${levelName}`);
    }

    const printableName = (
      levelName + " ".repeat(5 - levelName.length)
    ).toUpperCase();

    logger[levelName] = (
      message: unknown,
      contexts?: Contexts | ContextObj | undefined
    ) => {
      if (
        shouldLog({
          loggerName,
          desiredLevel,
          defaultLevel,
          resolver,
          contexts,
        })
      ) {
        const printableMessage =
          typeof message === "string" ? message : JSON.stringify(message);

        const output = `${printableName} ${loggerName}: ${printableMessage}`;
        console.log(output);

        return output;
      } else {
        return undefined;
      }
    };
  });

  return logger;
};
