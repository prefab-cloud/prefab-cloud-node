import Long from "long";
import type { Config } from "../../proto";
import { ConfigType } from "../../proto";
import { irrelevantLong } from "../testHelpers";

const config: Config = {
  id: new Long(999),
  projectId: irrelevantLong,
  key: "deleted.value",
  changedBy: undefined,
  rows: [],
  allowableValues: [],
  configType: ConfigType.DELETED,
  valueType: 1,
  sendToClientSdk: false,
};

export default config;
