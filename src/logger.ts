import type { Contexts } from "./types";
import { type Resolver } from "./resolver";

export const PREFIX = "log-level.";

const WORD_LEVEL_LOOKUP: Record<string, number> = {
  trace: 1,
  debug: 2,
  info: 3,
  warn: 5,
  error: 6,
  fatal: 9,
};

export const wordLevelToNumber = (level: string): number => {
  return WORD_LEVEL_LOOKUP[level] ?? Infinity;
};

export const shouldLog = ({
  loggerName,
  desiredLevel,
  defaultLevel,
  resolver,
  contexts,
}: {
  loggerName: string;
  desiredLevel: number;
  defaultLevel?: number;
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

  return (defaultLevel ?? resolver.defaultLogLevel) <= desiredLevel;
};
