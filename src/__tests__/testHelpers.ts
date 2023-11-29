import Long from "long";
import { ConfigType } from "../proto";
import type { Config } from "../proto";
import { wordLevelToNumber, PREFIX } from "../logger";
import type { ValidLogLevelName } from "../logger";

export const nTimes = (n: number, fn: () => void): void => {
  for (let i = 0; i < n; i++) {
    fn();
  }
};

export const projectEnvIdUnderTest = new Long(5);
export const emptyContexts = new Map();
export const irrelevant = "this value does not matter";
export const irrelevantLong = new Long(-1);

export const levelAt = (path: string, level: string): Config => {
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
              logLevel: wordLevelToNumber(level as ValidLogLevelName),
            },
          },
        ],
      },
    ],
    allowableValues: [],
    configType: ConfigType.LOG_LEVEL,
    valueType: 9,
  };
};

export const mockApiClient = {
  fetch: jest.fn(async () => ({
    status: 200,
    arrayBuffer: async (): Promise<ArrayBuffer> => {
      return await Promise.resolve(new ArrayBuffer(0));
    },
  })),
};
