export interface SyncResult {
  status: number;
  dataSent: any;
}

export interface Telemetry {
  sync: () => Promise<SyncResult | undefined>;
  enabled: boolean;
  timeout: NodeJS.Timeout | undefined;
}

export type ContextUploadMode = "periodicExample" | "shapeOnly" | "none";
