import Long from "long";
import { Backoff } from "./backoff";

export interface SyncResult {
  status: number;
  dataSent: any;
}

export interface Telemetry {
  sync: () => Promise<SyncResult | undefined>;
  enabled: boolean;
  timeout: NodeJS.Timeout | undefined;
}

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
      const backoff = new Backoff({ maxDelay: 600, initialDelay: 8 });

      if (telemetry.enabled) {
        syncTelemetry(telemetry, backoff);
      }
    });
  },
};
