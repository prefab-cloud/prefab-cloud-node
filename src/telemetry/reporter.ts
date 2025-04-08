import Long from "long";
import { Backoff } from "./backoff";
import type { Telemetry } from "./types";

export const now = (): Long => Long.fromNumber(Date.now());

const syncTelemetry = (telemetry: Telemetry, backoff: Backoff): void => {
  // Exit early if telemetry is disabled
  if (!telemetry.enabled) {
    return;
  }

  const delay = backoff.call();

  telemetry.timeout = setTimeout(() => {
    // Check if telemetry is still enabled before attempting to sync
    if (!telemetry.enabled) {
      return;
    }

    telemetry.sync().finally(() => {
      syncTelemetry(telemetry, backoff);
    });
  }, delay * 1000);
};

export const TelemetryReporter = {
  start(telemetries: Telemetry[]): void {
    telemetries.forEach((telemetry) => {
      if (telemetry.enabled) {
        const backoff = new Backoff({ maxDelay: 600, initialDelay: 8 });

        syncTelemetry(telemetry, backoff);
      }
    });
  },
};
