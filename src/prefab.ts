import crypto from "crypto";
import type Long from "long";
import { apiClient, type ApiClient } from "./apiClient";
import { loadConfig } from "./loadConfig";
import { Resolver, type MinimumConfig } from "./resolver";
import type {
  ContextObj,
  Contexts,
  Fetch,
  OnNoDefault,
  ProjectEnvId,
} from "./types";
import {
  ConfigType,
  Config_ValueType as ConfigValueType,
  LogLevel,
  ProvidedSource,
} from "./proto";
import type {
  ConditionalValue,
  Config,
  ConfigValue,
  ConfigRow,
  Provided,
} from "./proto";
import { shouldLog, wordLevelToNumber, parseLevel } from "./logger";
import type { ValidLogLevelName, ValidLogLevel } from "./logger";
import type { GetValue } from "./unwrap";
import { SSEConnection } from "./sseConnection";
import { TelemetryReporter } from "./telemetry/reporter";

import type { ContextUploadMode } from "./telemetry/types";
import { knownLoggers } from "./telemetry/knownLoggers";
import { contextShapes } from "./telemetry/contextShapes";
import { exampleContexts } from "./telemetry/exampleContexts";
import { evaluationSummaries } from "./telemetry/evaluationSummaries";
import { encrypt, generateNewHexKey } from "./encryption";

const DEFAULT_POLL_INTERVAL = 60 * 1000;
const PREFAB_DEFAULT_LOG_LEVEL = LogLevel.WARN;
export const MULTIPLE_INIT_WARNING =
  "[prefab] init() called multiple times. This is generally not recommended as it can lead to multiple concurrent SSE connections and/or redundant polling. A Prefab instance is typically meant to be long-lived and exist outside of your request/response life-cycle. If you're using `init()` to change context, you're better off using `inContext` or setting per-request context to pass to your `get`/etc. calls.";

function requireResolver(
  resolver: Resolver | undefined
): asserts resolver is Resolver {
  if (resolver === undefined) {
    throw new Error("prefab.resolver is undefined. Did you call init()?");
  }
}

export interface PrefabInterface {
  get: (
    key: string,
    contexts?: Contexts | ContextObj,
    defaultValue?: GetValue
  ) => GetValue;
  isFeatureEnabled: (key: string, contexts?: Contexts | ContextObj) => boolean;
}

export interface Telemetry {
  knownLoggers: ReturnType<typeof knownLoggers>;
  contextShapes: ReturnType<typeof contextShapes>;
  exampleContexts: ReturnType<typeof exampleContexts>;
  evaluationSummaries: ReturnType<typeof evaluationSummaries>;
}

interface ConstructorProps {
  apiKey: string;
  apiUrl?: string;
  cdnUrl?: string;
  datafile?: string;
  enablePolling?: boolean;
  enableSSE?: boolean;
  namespace?: string;
  onNoDefault?: OnNoDefault;
  pollInterval?: number;
  fetch?: Fetch;
  defaultLogLevel?: ValidLogLevel | ValidLogLevelName;
  collectLoggerCounts?: boolean;
  contextUploadMode?: ContextUploadMode;
  collectEvaluationSummaries?: boolean;
  onUpdate?: (configs: Config[]) => void;
}

class Prefab implements PrefabInterface {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly cdnUrl: string;
  private readonly datafile?: string;
  private readonly enableSSE: boolean;
  private enablePolling: boolean;
  private readonly namespace?: string;
  private readonly onNoDefault: "error" | "warn" | "ignore";
  private readonly pollInterval: number;
  private resolver?: Resolver;
  private readonly apiClient: ApiClient;
  private readonly defaultLogLevel: ValidLogLevel;
  private readonly instanceHash: string;
  private readonly onUpdate: (configs: Config[]) => void;
  private initCount: number = 0;
  readonly telemetry: Telemetry;

  constructor({
    apiKey,
    apiUrl,
    namespace,
    cdnUrl,
    datafile,
    onNoDefault,
    enableSSE,
    enablePolling,
    pollInterval,
    fetch = globalThis.fetch,
    defaultLogLevel = PREFAB_DEFAULT_LOG_LEVEL,
    collectLoggerCounts = true,
    contextUploadMode = "periodicExample",
    collectEvaluationSummaries = true,
    onUpdate = () => {},
  }: ConstructorProps) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl ?? "https://api.prefab.cloud";
    this.cdnUrl = cdnUrl ?? "https://api-prefab-cloud.global.ssl.fastly.net";
    this.datafile = datafile;
    this.enablePolling = enablePolling ?? false;
    this.enableSSE = enableSSE ?? true;
    this.namespace = namespace;
    this.onNoDefault = onNoDefault ?? "error";
    this.pollInterval = pollInterval ?? DEFAULT_POLL_INTERVAL;
    this.instanceHash = crypto.randomUUID();
    this.onUpdate = onUpdate;

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
      exampleContexts: exampleContexts(
        this.apiClient,
        this.instanceHash,
        contextUploadMode
      ),
      evaluationSummaries: evaluationSummaries(
        this.apiClient,
        this.instanceHash,
        collectEvaluationSummaries
      ),
    };
  }

  async init(
    runtimeConfig: Array<[key: string, value: ConfigValue]> = []
  ): Promise<void> {
    this.initCount += 1;

    if (this.initCount > 1 && (this.enableSSE || this.enablePolling)) {
      console.warn(MULTIPLE_INIT_WARNING);
    }

    const { configs, projectEnvId, startAtId, defaultContext } =
      await loadConfig({
        apiUrl: this.apiUrl,
        apiClient: this.apiClient,
        cdnUrl: this.cdnUrl,
        datafile: this.datafile,
      });

    this.setConfig(configs, projectEnvId, defaultContext);

    runtimeConfig.forEach(([key, value]) => {
      this.set(key, value);
    });

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

  setConfig(
    config: Config[],
    projectEnvId: ProjectEnvId,
    defaultContext: Contexts
  ): void {
    this.resolver = new Resolver(
      config,
      projectEnvId,
      this.namespace,
      this.onNoDefault,
      this.telemetry,
      undefined,
      this.onUpdate,
      defaultContext
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
      if (!this.enablePolling) {
        return;
      }

      loadConfig({
        cdnUrl: this.cdnUrl,
        apiUrl: this.apiUrl,
        apiClient: this.apiClient,
      })
        .then(({ configs, defaultContext }) => {
          if (configs.length > 0) {
            this.resolver?.update(configs, defaultContext);
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

  stopPolling(): void {
    this.enablePolling = false;
    clearTimeout(this.pollInterval);
  }

  inContext(
    contexts: Contexts | ContextObj,
    func: (prefab: Resolver) => void
  ): void {
    requireResolver(this.resolver);

    func(this.resolver.cloneWithContext(contexts));
  }

  get(
    key: string,
    contexts?: Contexts | ContextObj,
    defaultValue?: GetValue
  ): GetValue {
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
    contexts?: Contexts | ContextObj;
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

  isFeatureEnabled(key: string, contexts?: Contexts | ContextObj): boolean {
    requireResolver(this.resolver);

    return this.resolver.isFeatureEnabled(key, contexts);
  }

  raw(key: string): MinimumConfig | undefined {
    requireResolver(this.resolver);

    return this.resolver.raw(key);
  }

  keys(): string[] {
    requireResolver(this.resolver);

    return this.resolver.keys();
  }

  defaultContext(): Contexts | undefined {
    requireResolver(this.resolver);

    return this.resolver.defaultContext;
  }

  set(key: string, value: ConfigValue): void {
    requireResolver(this.resolver);

    this.resolver.set(key, value);
  }
}

const encryption = {
  encrypt,
  generateNewHexKey,
};

export {
  ConfigType,
  ConfigValueType,
  LogLevel,
  Prefab,
  ProvidedSource,
  encryption,
  type ConditionalValue,
  type ConfigRow,
  type ConfigValue,
  type Contexts,
  type Provided,
  type ValidLogLevel,
  type ValidLogLevelName,
  wordLevelToNumber,
};
