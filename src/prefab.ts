// TODO: test not provided behavior throughout
import type Long from "long";
import { loadConfig } from "./loadConfig";
import { Resolver } from "./resolver";
import type { Contexts, OnNoDefault, ProjectEnvId } from "./types";

import type { Config } from "./proto";
import { ConfigType, LogLevel } from "./proto";
import { wordLevelToNumber } from "./logger";
import type { GetValue } from "./unwrap";
import { SSEConnection } from "./sseConnection";

const DEFAULT_POLL_INTERVAL = 60 * 1000;
const PREFAB_DEFAULT_LOG_LEVEL = LogLevel.WARN;

function requireResolver(
  resolver: Resolver | undefined
): asserts resolver is Resolver {
  if (resolver === undefined) {
    throw new Error("prefab.resolver is undefined. Did you call init()?");
  }
}

export interface PrefabInterface {
  get: (key: string, contexts?: Contexts, defaultValue?: GetValue) => GetValue;
  isFeatureEnabled: (key: string, contexts?: Contexts) => boolean;
}

interface ConstructorProps {
  apiKey: string;
  apiUrl?: string;
  cdnUrl?: string;
  enablePolling?: boolean;
  enableSSE?: boolean;
  namespace?: string;
  onNoDefault?: OnNoDefault;
  pollInterval?: number;
  fetch?: typeof globalThis.fetch;
  defaultLogLevel?: number;
}

class Prefab implements PrefabInterface {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly cdnUrl: string;
  private readonly enableSSE: boolean;
  private readonly enablePolling: boolean;
  private readonly namespace?: string;
  private readonly onNoDefault: "error" | "warn" | "ignore";
  private readonly pollInterval: number;
  private resolver?: Resolver;
  private readonly fetch: typeof globalThis.fetch;
  private readonly defaultLogLevel: number;

  constructor({
    apiKey,
    apiUrl,
    namespace,
    cdnUrl,
    onNoDefault,
    enableSSE,
    enablePolling,
    pollInterval,
    fetch = globalThis.fetch,
    defaultLogLevel = PREFAB_DEFAULT_LOG_LEVEL,
  }: ConstructorProps) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl ?? "https://api.prefab.cloud";
    this.cdnUrl = cdnUrl ?? "https://api-prefab-cloud.global.ssl.fastly.net";
    this.enablePolling = enablePolling ?? false;
    this.enableSSE = enableSSE ?? false;
    this.namespace = namespace;
    this.onNoDefault = onNoDefault ?? "error";
    this.pollInterval = pollInterval ?? DEFAULT_POLL_INTERVAL;
    this.defaultLogLevel = defaultLogLevel;
    this.fetch = fetch;
  }

  async init(): Promise<void> {
    const { configs, projectEnvId, startAtId } = await loadConfig({
      apiKey: this.apiKey,
      cdnUrl: this.cdnUrl,
      apiUrl: this.apiUrl,
      fetch: this.fetch,
    });

    this.setConfig(configs, projectEnvId);

    if (this.enableSSE) {
      this.startSSE(startAtId);
    }

    if (this.enablePolling) {
      setTimeout(() => {
        this.startPolling();
      }, this.pollInterval);
    }
  }

  setConfig(config: Config[], projectEnvId: ProjectEnvId): void {
    this.resolver = new Resolver(
      config,
      projectEnvId,
      this.namespace,
      this.onNoDefault,
      this.defaultLogLevel
    );
  }

  startSSE(startAtId: Long): void {
    requireResolver(this.resolver);

    const connection = new SSEConnection({
      apiKey: this.apiKey,
      apiUrl: this.apiUrl,
    });

    connection.start(this.resolver, startAtId);
  }

  startPolling(): void {
    requireResolver(this.resolver);

    const poll = (): void => {
      loadConfig({
        apiKey: this.apiKey,
        cdnUrl: this.cdnUrl,
        apiUrl: this.apiUrl,
      })
        .then(({ configs }) => {
          if (configs.length > 0) {
            this.resolver?.update(configs);
          }
        })
        .catch((err) => {
          console.error(err);
        })
        .finally(() => {
          setTimeout(poll, this.pollInterval);
        });
    };

    poll();
  }

  inContext(contexts: Contexts, func: (prefab: Resolver) => void): void {
    requireResolver(this.resolver);

    func(this.resolver.cloneWithContext(contexts));
  }

  get(key: string, contexts?: Contexts, defaultValue?: GetValue): GetValue {
    requireResolver(this.resolver);

    return this.resolver.get(key, contexts, defaultValue);
  }

  shouldLog({
    loggerName,
    desiredLevel,
    defaultLogLevel,
    contexts,
  }: {
    loggerName: string;
    desiredLevel: number;
    defaultLogLevel?: number;
    contexts?: Contexts;
  }): boolean {
    requireResolver(this.resolver);

    return this.resolver.shouldLog({
      loggerName,
      desiredLevel,
      contexts,
      defaultLogLevel,
    });
  }

  isFeatureEnabled(key: string, contexts?: Contexts): boolean {
    requireResolver(this.resolver);

    return this.resolver.isFeatureEnabled(key, contexts);
  }
}

export { Prefab, LogLevel, wordLevelToNumber, type Contexts, type ConfigType };
