import protobuf from "protobufjs/light.js";
import type { Configs } from "./proto";
import protoJSON from "./proto.json";
const root = protobuf.Root.fromJSON(protoJSON);

export const parseConfigs = (input: ArrayBuffer | string): Configs => {
  return decode<Configs>("Configs", input);
};

export const decode = <T>(type: string, input: ArrayBuffer | string): T => {
  const buffer =
    typeof input === "string"
      ? Buffer.from(input, "base64")
      : Buffer.from(input);

  return root.lookupType("prefab." + type).decode(buffer) as T;
};

export const encode = (type: string, data: any): ArrayBuffer => {
  return root
    .lookupType("prefab." + type)
    .encode(data)
    .finish();
};
