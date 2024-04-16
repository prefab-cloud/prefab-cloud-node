import Long from "long";
import type { Config } from "../../proto";
import { ConfigType } from "../../proto";
import { irrelevantLong } from "../testHelpers";

// This is technically a deleted config. It has no rows, but its configType is still CONFIG (rather than DELETED)

const config: Config = {
  id: new Long(999),
  projectId: irrelevantLong,
  key: "mostly.deleted.value",
  changedBy: undefined,
  rows: [],
  allowableValues: [],
  configType: ConfigType.CONFIG,
  valueType: 1,
  sendToClientSdk: false,
};

export default config;
