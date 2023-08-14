import type Long from "long";
import { makeHeaders } from "./makeHeaders";
import type { Resolver } from "./resolver";
import EventSource from "eventsource";
import { parseConfigs } from "./parseConfigs";

interface ConstructorProps {
  apiKey: string;
  apiUrl: string;
}

class SSEConnection {
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor({ apiKey, apiUrl }: ConstructorProps) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
  }

  start(resolver: Resolver, startAtId: Long): void {
    const headers = makeHeaders(this.apiKey, {
      "x-prefab-start-at-id": startAtId.toString(),
    });

    const channel = new EventSource(`${this.apiUrl}/api/v1/sse/config`, {
      headers,
    });

    channel.onmessage = (message: any) => {
      const newConfigs = parseConfigs(message.data);

      resolver.update(newConfigs.configs);
    };
  }
}

export { SSEConnection };
