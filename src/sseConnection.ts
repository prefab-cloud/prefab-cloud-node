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
  private channel?: EventSource; // Store the EventSource instance

  constructor({ apiKey, sources }: ConstructorProps) {
    this.apiKey = apiKey;
    this.sources = sources;
  }

  start(resolver: Resolver, startAtId: Long): void {
    const headers = makeHeaders(this.apiKey, {
      "x-prefab-start-at-id": startAtId.toString(),
      Accept: "text/event-stream",
    });

    const url = `${(this.sources[0] as string).replace(
      /(belt|suspenders)\./,
      "stream."
    )}/api/v1/sse/config`;

    this.channel = new EventSource(url, { headers });

    this.channel.onmessage = (message: any) => {
      const newConfigs = parseConfigs(message.data);

      resolver.update(newConfigs.configs);
    };
  }

  close(): void {
    if (this.channel !== undefined && this.channel != null) {
      this.channel.close();
      this.channel = undefined;
    }
  }
}

export { SSEConnection };
