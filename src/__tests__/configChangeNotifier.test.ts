import Long from "long";
import {
  ConfigChangeNotifier,
  type ResolverInterface,
} from "../configChangeNotifier";
import type { MinimumConfig } from "../resolver";

// Mock ResolverInterface
const mockResolver: jest.Mocked<ResolverInterface> = {
  keys: jest.fn(),
  raw: jest.fn(),
};

describe("ConfigChangeNotifier", () => {
  let notifier: ConfigChangeNotifier;
  let listenerCallback: jest.Mock;

  beforeEach(() => {
    notifier = new ConfigChangeNotifier();
    listenerCallback = jest.fn();
    // Reset mocks for each test
    mockResolver.keys.mockReset();
    mockResolver.raw.mockReset();
    // Set a default return value for keys to prevent "not iterable" errors
    mockResolver.keys.mockReturnValue([]);
  });

  describe("constructor and init", () => {
    it("should initialize with ZERO lastTotalId before init", () => {
      expect(notifier.getLastTotalId().equals(Long.ZERO)).toBe(true);
    });

    it("should calculate and set lastTotalId on init", () => {
      mockResolver.keys.mockReturnValue(["key1"]);
      mockResolver.raw.mockReturnValue({ id: Long.fromInt(10) });

      notifier.init(mockResolver);
      expect(notifier.getLastTotalId().toNumber()).toBe(10);
    });

    it("should set lastTotalId to ZERO if resolver has no configs on init", () => {
      mockResolver.keys.mockReturnValue([]);
      notifier.init(mockResolver);
      expect(notifier.getLastTotalId().equals(Long.ZERO)).toBe(true);
    });

    it("should allow re-initialization with a new resolver and update lastTotalId", () => {
      // First initialization
      mockResolver.keys.mockReturnValue(["key1"]);
      mockResolver.raw.mockReturnValue({ id: Long.fromInt(10) });
      notifier.init(mockResolver);
      expect(notifier.getLastTotalId().toNumber()).toBe(10);
      expect(mockResolver.keys).toHaveBeenCalledTimes(1); // Called during the first init

      // Create a new mock resolver for the second initialization
      const newMockResolver: jest.Mocked<ResolverInterface> = {
        keys: jest.fn().mockReturnValue(["key2", "key3"]),
        raw: jest.fn((key: string) => {
          if (key === "key2") return { id: Long.fromInt(20) };
          if (key === "key3") return { id: Long.fromInt(30) }; // New max ID
          return undefined;
        }),
      };

      // Second initialization with the new resolver
      notifier.init(newMockResolver);
      expect(notifier.getLastTotalId().toNumber()).toBe(30); // Should reflect newMockResolver's state
      expect(newMockResolver.keys).toHaveBeenCalledTimes(1); // Called during the second init

      // Ensure the original mockResolver's keys was not called again during the second init
      expect(mockResolver.keys).toHaveBeenCalledTimes(1);
    });
  });

  describe("addListener and removeListener", () => {
    it("should add a listener and return an unsubscribe function", () => {
      const unsubscribe = notifier.addListener(listenerCallback);

      // Init with totalId = 0 (mockResolver.keys returns [] by default)
      notifier.init(mockResolver);
      expect(notifier.getLastTotalId().equals(Long.ZERO)).toBe(true);

      // Trigger with new totalId = 1
      mockResolver.keys.mockReturnValueOnce(["key1"]); // Override for this specific call inside handleResolverUpdate
      mockResolver.raw.mockReturnValueOnce({ id: Long.fromInt(1) });
      notifier.handleResolverUpdate();
      expect(listenerCallback).toHaveBeenCalledTimes(1);

      unsubscribe();
      // For the next handleResolverUpdate, keys will revert to default mockReturnValue([]) or need to be set again
      // If we want to test it changes again and listener is NOT called:
      mockResolver.keys.mockReturnValueOnce(["key2"]); // Setup for next call
      mockResolver.raw.mockReturnValueOnce({ id: Long.fromInt(2) }); // Change ID again
      notifier.handleResolverUpdate();
      expect(listenerCallback).toHaveBeenCalledTimes(1); // Still 1, as it was unsubscribed
    });

    it("should remove a listener with removeListener", () => {
      notifier.addListener(listenerCallback);
      notifier.removeListener(listenerCallback);

      mockResolver.keys.mockReturnValueOnce([]).mockReturnValueOnce(["key1"]);
      mockResolver.raw.mockReturnValueOnce({ id: Long.fromInt(1) });
      notifier.init(mockResolver);
      notifier.handleResolverUpdate();

      expect(listenerCallback).not.toHaveBeenCalled();
    });
  });

  describe("handleResolverUpdate", () => {
    beforeEach(() => {
      // Ensure notifier is initialized for these tests
      mockResolver.keys.mockReturnValue([]); // Start with no configs, totalId = 0
      notifier.init(mockResolver);
      notifier.addListener(listenerCallback);
    });

    it("should notify listeners when totalId changes", () => {
      mockResolver.keys.mockReturnValue(["key1"]);
      mockResolver.raw.mockReturnValue({ id: Long.fromInt(5) }); // New totalId = 5

      notifier.handleResolverUpdate();

      expect(listenerCallback).toHaveBeenCalledTimes(1);
      expect(notifier.getLastTotalId().toNumber()).toBe(5);
    });

    it("should NOT notify listeners when totalId does not change", () => {
      mockResolver.keys.mockReturnValue(["key1"]);
      mockResolver.raw.mockReturnValue({ id: Long.fromInt(0) }); // Same as initial Long.ZERO

      notifier.handleResolverUpdate();

      expect(listenerCallback).not.toHaveBeenCalled();
      expect(notifier.getLastTotalId().equals(Long.ZERO)).toBe(true);
    });

    it("should handle multiple listeners", () => {
      const listener2 = jest.fn();
      notifier.addListener(listener2);

      mockResolver.keys.mockReturnValue(["key1"]);
      mockResolver.raw.mockReturnValue({ id: Long.fromInt(10) });

      notifier.handleResolverUpdate();

      expect(listenerCallback).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it("should log a warning if handleResolverUpdate is called before init", () => {
      const freshNotifier = new ConfigChangeNotifier(); // Not initialized
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

      freshNotifier.handleResolverUpdate();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "ConfigChangeNotifier.handleResolverUpdate called before init. Skipping."
      );
      consoleWarnSpy.mockRestore();
    });
  });

  describe("calculateCurrentTotalId", () => {
    it("should return Long.ZERO if resolver is not initialized", () => {
      const freshNotifier = new ConfigChangeNotifier();
      // Access private method for testing - might need @ts-ignore or a different approach for strictness
      expect(
        (freshNotifier as any).calculateCurrentTotalId().equals(Long.ZERO)
      ).toBe(true);
    });

    it("should return Long.ZERO for no keys", () => {
      mockResolver.keys.mockReturnValue([]);
      notifier.init(mockResolver);
      expect(
        (notifier as any).calculateCurrentTotalId().equals(Long.ZERO)
      ).toBe(true);
    });

    it("should correctly calculate maxId from resolver data", () => {
      mockResolver.keys.mockReturnValue(["key1", "key2", "key3"]);
      mockResolver.raw.mockImplementation((key: string) => {
        if (key === "key1") return { id: Long.fromInt(1) };
        if (key === "key2") return { id: Long.fromInt(100) }; // Max
        if (key === "key3") return { id: Long.fromInt(50) };
        return undefined;
      });
      notifier.init(mockResolver); // Recalculates based on this new mock setup for the test
      expect((notifier as any).calculateCurrentTotalId().toNumber()).toBe(100);
    });

    it("should ignore configs with no id or non-Long id", () => {
      mockResolver.keys.mockReturnValue(["key1", "key2", "key3", "key4"]);
      mockResolver.raw.mockImplementation(
        (key: string): Pick<MinimumConfig, "id"> | undefined => {
          if (key === "key1") return { id: Long.fromInt(5) };
          if (key === "key2") return { id: undefined }; // id is present but undefined
          if (key === "key3") return { id: "not-a-long" as any }; // id is present but not a Long
          if (key === "key4") return { id: undefined }; // Represents a config object that might exist but its id is not set or not relevant
          return undefined;
        }
      );
      notifier.init(mockResolver);
      expect((notifier as any).calculateCurrentTotalId().toNumber()).toBe(5);
    });
  });
});
