import type Long from "long";
import { makeHeaders } from "./makeHeaders";
import type { Resolver } from "./resolver";
import EventSource from "eventsource";
import { parseConfigs } from "./parseProto";

interface ConstructorProps {
  apiKey: string;
  sources: string[];
}

class SSEConnection {
  private readonly apiKey: string;
  private readonly sources: string[];

  constructor({ apiKey, sources }: ConstructorProps) {
    this.apiKey = apiKey;
    this.sources = sources;
  }

  start(resolver: Resolver, startAtId: Long): void {
    const headers = makeHeaders(this.apiKey, {
      "x-prefab-start-at-id": startAtId.toString(),
      Accept: "text/event-stream",
    });

    // TODO: use sources here
    const channel = new EventSource(
      `${this.sources[0] as string}/api/v1/sse/config`,
      {
        headers,
      }
    );

    channel.onmessage = (message: any) => {
      const newConfigs = parseConfigs(message.data);

      resolver.update(newConfigs.configs);
    };
  }
}

export { SSEConnection };
