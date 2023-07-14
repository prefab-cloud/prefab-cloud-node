import type { Contexts } from "./types";
import { type Resolver } from "./resolver";

export const PREFIX = "log-level.";

export type ValidLogLevelName =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal";

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
  contexts?: Contexts;
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
