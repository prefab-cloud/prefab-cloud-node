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

export const wordLevelToNumber = (level: string): number | undefined => {
  return WORD_LEVEL_LOOKUP[level];
};

export const parseLevel = (
  level: number | string | undefined
): number | undefined => {
  if (typeof level === "number") {
    return level;
  }

  if (typeof level === "string") {
    return wordLevelToNumber(level.toLowerCase());
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
  desiredLevel: number | string;
  defaultLevel?: number | string;
  resolver: Resolver;
  contexts?: Contexts;
}): boolean => {
  let loggerNameWithPrefix = PREFIX + loggerName;

  const numericDesiredLevel = parseLevel(desiredLevel);

  if (typeof numericDesiredLevel === "undefined") {
    console.warn(
      `[prefab] desiredLevel \`${desiredLevel}\` is not a valid level`
    );
    return false;
  }

  while (loggerNameWithPrefix.includes(".")) {
    const resolvedLevel = resolver.get(
      loggerNameWithPrefix,
      contexts,
      undefined,
      "ignore"
    );

    if (resolvedLevel !== undefined) {
      return Number(resolvedLevel) <= numericDesiredLevel;
    }

    loggerNameWithPrefix = loggerNameWithPrefix.slice(
      0,
      loggerNameWithPrefix.lastIndexOf(".")
    );
  }

  const numericDefaultLevel = parseLevel(defaultLevel);

  return (
    (numericDefaultLevel ?? resolver.defaultLogLevel) <= numericDesiredLevel
  );
};
