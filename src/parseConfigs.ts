import protobuf from "protobufjs/light";
import type { Configs } from "./proto";
import protoJSON from "./proto.json";
const root = protobuf.Root.fromJSON(protoJSON);

export const parseConfigs = (input: ArrayBuffer | string): Configs => {
  const buffer =
    typeof input === "string"
      ? Buffer.from(input, "base64")
      : Buffer.from(input);

  // @ts-expect-error - there's something amiss here since moduleResolution was specified
  return root.lookupType("prefab.Configs").decode(buffer) as Configs;
};
