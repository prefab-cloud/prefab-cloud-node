import Long from "long";
import { knownLoggers, stub } from "../../telemetry/knownLoggers";

describe("knownLoggers", () => {
  const mockApiClient = {
    fetch: jest.fn(async () => ({
      status: 200,
      arrayBuffer: async (): Promise<ArrayBuffer> => {
        return await Promise.resolve(new ArrayBuffer(0));
      },
    })),
  };

  it("should initialize a known logger with collectLoggerCounts set to false", () => {
    const logger = knownLoggers(mockApiClient, "instanceHash", false);
    expect(logger).toBe(stub);
  });

  it("should initialize a known logger with collectLoggerCounts set to true", () => {
    const logger = knownLoggers(mockApiClient, "instanceHash", true);
    expect(logger.data).toEqual({});
  });

  it("should push log entries to the logger", () => {
    const logger = knownLoggers(mockApiClient, "instanceHash", true);
    logger.push("loggerName1", 1);
    logger.push("loggerName1", 1);
    logger.push("loggerName2", 2);

    expect(logger.data).toEqual({
      loggerName1: { 1: 2 },
      loggerName2: { 2: 1 },
    });
  });

  it("should sync log entries to the server", async () => {
    const mockFetchResult = {
      status: 200,
      arrayBuffer: async (): Promise<ArrayBuffer> => {
        return await Promise.resolve(new ArrayBuffer(0));
      },
    };
    mockApiClient.fetch.mockResolvedValue(mockFetchResult);

    const logger = knownLoggers(mockApiClient, "instanceHash", true);
    logger.push("loggerName1", 1);
    logger.push("loggerName1", 2);
    logger.push("loggerName1", 1);
    logger.push("loggerName2", 2);

    const syncResult = await logger.sync();

    expect(mockApiClient.fetch).toHaveBeenCalled();
    expect(syncResult).toEqual({
      status: 200,
      dataSent: expect.objectContaining({
        loggers: [
          {
            loggerName: "loggerName1",
            traces: new Long(2),
            debugs: new Long(1),
          },
          {
            loggerName: "loggerName2",
            debugs: new Long(1),
          },
        ],
        startAt: expect.any(Long),
        endAt: expect.any(Long),
        instanceHash: "instanceHash",
      }),
    });
  });
});
