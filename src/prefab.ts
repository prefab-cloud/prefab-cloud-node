import crypto from "crypto";
import type Long from "long";
import { apiClient, type ApiClient } from "./apiClient";
import { loadConfig } from "./loadConfig";
import { Resolver } from "./resolver";
import type { Contexts, Fetch, OnNoDefault, ProjectEnvId } from "./types";

import { LogLevel } from "./proto";
import type { Config, ConfigType } from "./proto";
import { shouldLog, wordLevelToNumber, parseLevel } from "./logger";
import type { ValidLogLevelName, ValidLogLevel } from "./logger";
import type { GetValue } from "./unwrap";
import { SSEConnection } from "./sseConnection";
import { TelemetryReporter } from "./telemetry/reporter";

import type { ContextUploadMode } from "./telemetry/types";
import { knownLoggers } from "./telemetry/knownLoggers";
import { contextShapes } from "./telemetry/contextShapes";

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

export interface Telemetry {
  knownLoggers: ReturnType<typeof knownLoggers>;
  contextShapes: ReturnType<typeof contextShapes>;
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
  fetch?: Fetch;
  defaultLogLevel?: ValidLogLevel | ValidLogLevelName;
  collectLoggerCounts?: boolean;
  contextUploadMode?: ContextUploadMode;
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
  private readonly apiClient: ApiClient;
  private readonly defaultLogLevel: ValidLogLevel;
  readonly telemetry: Telemetry;

  readonly instanceHash: string;
  readonly collectLoggerCounts: boolean;

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
    collectLoggerCounts = true,
    contextUploadMode = "periodicExample",
  }: ConstructorProps) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl ?? "https://api.prefab.cloud";
    this.cdnUrl = cdnUrl ?? "https://api-prefab-cloud.global.ssl.fastly.net";
    this.enablePolling = enablePolling ?? false;
    this.enableSSE = enableSSE ?? false;
    this.namespace = namespace;
    this.onNoDefault = onNoDefault ?? "error";
    this.pollInterval = pollInterval ?? DEFAULT_POLL_INTERVAL;
    this.instanceHash = crypto.randomUUID();
    this.collectLoggerCounts = collectLoggerCounts;

    const parsedDefaultLogLevel = parseLevel(defaultLogLevel);

    if (parsedDefaultLogLevel === undefined) {
      console.warn(
        `Invalid default log level provided: ${defaultLogLevel}. Defaulting to ${PREFAB_DEFAULT_LOG_LEVEL}.`
      );
    }

    this.defaultLogLevel = parsedDefaultLogLevel ?? PREFAB_DEFAULT_LOG_LEVEL;

    this.apiClient = apiClient(this.apiUrl, this.apiKey, fetch);

    this.telemetry = {
      knownLoggers: knownLoggers(
        this.apiClient,
        this.instanceHash,
        collectLoggerCounts,
        this.namespace
      ),
      contextShapes: contextShapes(this.apiClient, contextUploadMode),
    };
  }

  async init(): Promise<void> {
    const { configs, projectEnvId, startAtId } = await loadConfig({
      apiUrl: this.apiUrl,
      apiClient: this.apiClient,
      cdnUrl: this.cdnUrl,
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

    setTimeout(() => {
      TelemetryReporter.start(Object.values(this.telemetry));
    });
  }

  setConfig(config: Config[], projectEnvId: ProjectEnvId): void {
    this.resolver = new Resolver(
      config,
      projectEnvId,
      this.namespace,
      this.onNoDefault,
      this.telemetry
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
        cdnUrl: this.cdnUrl,
        apiUrl: this.apiUrl,
        apiClient: this.apiClient,
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
    defaultLevel,
    contexts,
  }: {
    loggerName: string;
    desiredLevel: ValidLogLevel | ValidLogLevelName;
    defaultLevel?: ValidLogLevel | ValidLogLevelName;
    contexts?: Contexts;
  }): boolean {
    const numericDesiredLevel = parseLevel(desiredLevel);

    if (numericDesiredLevel === undefined) {
      console.warn(
        `[prefab]: Invalid desiredLevel \`${desiredLevel}\` provided to shouldLog. Returning \`true\``
      );

      return true;
    }

    this.telemetry.knownLoggers.push(loggerName, numericDesiredLevel);

    if (this.resolver !== undefined) {
      return shouldLog({
        loggerName,
        desiredLevel: numericDesiredLevel,
        contexts,
        resolver: this.resolver,
        defaultLevel: parseLevel(defaultLevel) ?? PREFAB_DEFAULT_LOG_LEVEL,
      });
    }

    console.warn(
      `[prefab] Still initializing... Comparing against defaultLogLevel setting: ${this.defaultLogLevel}`
    );

    return (
      (parseLevel(defaultLevel) ?? this.defaultLogLevel) <= numericDesiredLevel
    );
  }

  isFeatureEnabled(key: string, contexts?: Contexts): boolean {
    requireResolver(this.resolver);

    return this.resolver.isFeatureEnabled(key, contexts);
  }
}

export {
  Prefab,
  LogLevel,
  wordLevelToNumber,
  type Contexts,
  type ConfigType,
  type ValidLogLevelName,
  type ValidLogLevel,
};
