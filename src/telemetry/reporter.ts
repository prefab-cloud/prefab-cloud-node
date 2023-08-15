import Long from "long";
import { Backoff } from "./backoff";
import type { Telemetry } from "./types";

export const now = (): Long => Long.fromNumber(Date.now());

const syncTelemetry = (telemetry: Telemetry, backoff: Backoff): void => {
  const delay = backoff.call();

  telemetry.timeout = setTimeout(() => {
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
