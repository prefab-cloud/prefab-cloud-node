import crypto from "crypto";
import Long from "long";
import { apiClient, type ApiClient } from "./apiClient";
import { loadConfig } from "./loadConfig";
import { Resolver, type MinimumConfig, type ResolverAPI } from "./resolver";
import { Sources } from "./sources";
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
import { wordLevelToNumber, parseLevel } from "./logger";
import type { ValidLogLevelName, ValidLogLevel, makeLogger } from "./logger";
import type { GetValue } from "./unwrap";
import { SSEConnection } from "./sseConnection";
import { TelemetryReporter } from "./telemetry/reporter";

import type { ContextUploadMode } from "./telemetry/types";
import { knownLoggers } from "./telemetry/knownLoggers";
import { contextShapes } from "./telemetry/contextShapes";
import { exampleContexts } from "./telemetry/exampleContexts";
import { evaluationSummaries } from "./telemetry/evaluationSummaries";
import { encrypt, generateNewHexKey } from "./encryption";
import {
  ConfigChangeNotifier,
  type GlobalListenerCallback,
} from "./configChangeNotifier";

const DEFAULT_POLL_INTERVAL = 60 * 1000;
export const PREFAB_DEFAULT_LOG_LEVEL = LogLevel.WARN;
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
  logger: (
    loggerName: string,
    defaultLevel: ValidLogLevelName
  ) => ReturnType<typeof makeLogger>;
  shouldLog: ({
    loggerName,
    desiredLevel,
    defaultLevel,
    contexts,
  }: {
    loggerName: string;
    desiredLevel: ValidLogLevel | ValidLogLevelName;
    defaultLevel?: ValidLogLevel | ValidLogLevelName;
    contexts?: Contexts | ContextObj;
  }) => boolean;
  telemetry?: Telemetry;
  updateIfStalerThan: (durationInMs: number) => Promise<void> | undefined;
  withContext: (contexts: Contexts | ContextObj) => ResolverAPI;
  addConfigChangeListener: (callback: GlobalListenerCallback) => () => void;
}

export interface Telemetry {
  knownLoggers: ReturnType<typeof knownLoggers>;
  contextShapes: ReturnType<typeof contextShapes>;
  exampleContexts: ReturnType<typeof exampleContexts>;
  evaluationSummaries: ReturnType<typeof evaluationSummaries>;
}

interface ConstructorProps {
  apiKey: string;
  sources?: string[];
  datafile?: string;
  enablePolling?: boolean;
  enableSSE?: boolean;
  globalContext?: Contexts;
  namespace?: string;
  onNoDefault?: OnNoDefault;
  pollInterval?: number;
  fetch?: Fetch;
  defaultLogLevel?: ValidLogLevel | ValidLogLevelName;
  collectLoggerCounts?: boolean;
  contextUploadMode?: ContextUploadMode;
  collectEvaluationSummaries?: boolean;
  onUpdate?: (configs: Array<Config | MinimumConfig>) => void;
}

class Prefab implements PrefabInterface {
  private readonly apiKey: string;
  readonly sources: Sources;
  private readonly datafile?: string;
  private readonly enableSSE: boolean;
  private enablePolling: boolean;
  private readonly namespace?: string;
  private readonly onNoDefault: "error" | "warn" | "ignore";
  private readonly pollInterval: number;
  private resolver: Resolver | undefined;
  private readonly apiClient: ApiClient;
  private readonly defaultLogLevel: ValidLogLevel;
  private readonly instanceHash: string;
  private readonly onUpdate: (configs: Array<Config | MinimumConfig>) => void;
  private initCount: number = 0;
  private lastUpdatedAt: number = 0;
  private loading: boolean = false;
  private readonly globalContext?: Contexts;
  private sseConnection?: SSEConnection;
  readonly telemetry: Telemetry;
  private running = true;
  private pollTimeout?: NodeJS.Timeout;
  private startAtId = Long.fromInt(0);
  private readonly configChangeNotifier: ConfigChangeNotifier;

  constructor({
    apiKey,
    sources,
    namespace,
    datafile,
    onNoDefault,
    enableSSE,
    enablePolling,
    globalContext,
    pollInterval,
    fetch = globalThis.fetch,
    defaultLogLevel = PREFAB_DEFAULT_LOG_LEVEL,
    collectLoggerCounts = true,
    contextUploadMode = "periodicExample",
    collectEvaluationSummaries = true,
    onUpdate,
  }: ConstructorProps) {
    this.apiKey = apiKey;

    if (
      process.env["PREFAB_API_URL_OVERRIDE"] !== undefined &&
      process.env["PREFAB_API_URL_OVERRIDE"] !== ""
    ) {
      this.sources = new Sources([process.env["PREFAB_API_URL_OVERRIDE"]]);
    } else {
      this.sources = new Sources(sources);
    }

    this.datafile = datafile;
    this.enablePolling = enablePolling ?? false;
    this.enableSSE = enableSSE ?? true;
    this.namespace = namespace;
    this.onNoDefault = onNoDefault ?? "error";
    this.pollInterval = pollInterval ?? DEFAULT_POLL_INTERVAL;
    this.instanceHash = crypto.randomUUID();
    this.onUpdate = onUpdate ?? (() => {});
    this.globalContext = globalContext;

    const parsedDefaultLogLevel = parseLevel(defaultLogLevel);

    if (parsedDefaultLogLevel === undefined) {
      console.warn(
        `Invalid default log level provided: ${defaultLogLevel}. Defaulting to ${PREFAB_DEFAULT_LOG_LEVEL}.`
      );
    }

    if (this.sources.isEmpty()) {
      throw new Error("At least one source is required");
    }

    this.defaultLogLevel = parsedDefaultLogLevel ?? PREFAB_DEFAULT_LOG_LEVEL;

    this.apiClient = apiClient(this.apiKey, fetch);

    this.telemetry = {
      knownLoggers: knownLoggers(
        this.apiClient,
        this.sources.telemetrySource,
        this.instanceHash,
        collectLoggerCounts,
        this.namespace
      ),
      contextShapes: contextShapes(
        this.apiClient,
        this.sources.telemetrySource,
        contextUploadMode
      ),
      exampleContexts: exampleContexts(
        this.apiClient,
        this.sources.telemetrySource,
        this.instanceHash,
        contextUploadMode
      ),
      evaluationSummaries: evaluationSummaries(
        this.apiClient,
        this.sources.telemetrySource,
        this.instanceHash,
        collectEvaluationSummaries
      ),
    };

    this.configChangeNotifier = new ConfigChangeNotifier();
  }

  private _createOrReconfigureResolver(
    configs: Config[],
    projectEnvId: ProjectEnvId,
    defaultContext: Contexts
  ): void {
    const tempResolver = new Resolver(
      configs,
      projectEnvId,
      this.namespace,
      this.onNoDefault,
      this.updateIfStalerThan.bind(this),
      this.telemetry,
      undefined,
      () => {},
      defaultContext,
      this.globalContext
    );

    this.configChangeNotifier.init(tempResolver);

    const actualCombinedOnUpdate = (
      updatedConfigs: Array<Config | MinimumConfig>
    ): void => {
      this.onUpdate(updatedConfigs);
      this.configChangeNotifier.handleResolverUpdate();
    };

    tempResolver.setOnUpdate(actualCombinedOnUpdate);
    this.resolver = tempResolver;

    if (configs.length > 0) {
      actualCombinedOnUpdate(configs);
    }
  }

  async init({
    runtimeConfig = [],
  }: {
    runtimeConfig?: Array<[key: string, value: ConfigValue]>;
  } = {}): Promise<void> {
    this.initCount += 1;
    this.loading = true;

    if (this.initCount > 1 && (this.enableSSE || this.enablePolling)) {
      console.warn(MULTIPLE_INIT_WARNING);
    }

    if (this.resolver !== undefined) {
      console.warn("Prefab already initialized.");
      return;
    }

    try {
      const { configs, projectEnvId, startAtId, defaultContext } =
        await loadConfig({
          sources: this.sources.configSources,
          apiClient: this.apiClient,
          datafile: this.datafile,
        });

      this._createOrReconfigureResolver(configs, projectEnvId, defaultContext);

      this.loadingComplete();

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
    } catch (error) {
      console.error("Error during Prefab initialization:", error);
      throw error;
    }
  }

  logger(
    loggerName: string,
    defaultLevel?: ValidLogLevelName,
    contexts?: Contexts | ContextObj
  ): ReturnType<typeof makeLogger> {
    requireResolver(this.resolver);

    return this.resolver.logger(
      loggerName,
      defaultLevel ?? this.defaultLogLevel,
      contexts
    );
  }

  updateIfStalerThan(durationInMs: number): Promise<void> | undefined {
    requireResolver(this.resolver);

    if (!this.loading && this.lastUpdatedAt + durationInMs < Date.now()) {
      return this.updateNow();
    }

    return undefined;
  }

  /* eslint-disable-next-line @typescript-eslint/promise-function-async */
  updateNow(): Promise<void> {
    requireResolver(this.resolver);
    this.loading = true;

    return loadConfig({
      sources: this.sources.configSources,
      apiClient: this.apiClient,
      startAtId: this.startAtId,
    }).then(({ configs, defaultContext, startAtId }) => {
      if (configs.length > 0) {
        this.resolver?.update(configs, defaultContext);
        this.startAtId = startAtId;
      }
      this.loadingComplete();
    });
  }

  setConfig(
    config: Config[],
    projectEnvId: ProjectEnvId,
    defaultContext: Contexts
  ): void {
    this._createOrReconfigureResolver(config, projectEnvId, defaultContext);
  }

  startSSE(startAtId: Long): void {
    requireResolver(this.resolver);

    this.sseConnection = new SSEConnection({
      apiKey: this.apiKey,
      sources: this.sources.sseSources,
    });

    this.sseConnection.start(this.resolver, startAtId);
  }

  startPolling(): void {
    requireResolver(this.resolver);

    const poll = (): void => {
      if (!this.enablePolling) {
        return;
      }

      this.updateNow()
        .catch((err) => {
          console.error(err);
        })
        .finally(() => {
          if (this.running) {
            this.pollTimeout = setTimeout(poll, this.pollInterval);
          }
        });
    };

    poll();
  }

  stopPolling(): void {
    this.enablePolling = false;
    clearTimeout(this.pollInterval);
  }

  inContext<T>(
    contexts: Contexts | ContextObj,
    func: (prefab: Resolver) => T
  ): T {
    requireResolver(this.resolver);

    return func(this.resolver.cloneWithContext(contexts));
  }

  withContext(contexts: Contexts | ContextObj): ResolverAPI {
    requireResolver(this.resolver);

    return this.resolver.cloneWithContext(contexts);
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
    if (this.resolver != null) {
      return this.resolver.shouldLog({
        loggerName,
        desiredLevel,
        defaultLevel,
        contexts,
      });
    }

    const numericDesiredLevel = parseLevel(desiredLevel);

    if (numericDesiredLevel === undefined) {
      console.warn(
        `[prefab]: Invalid desiredLevel \`${desiredLevel}\` provided to shouldLog. Returning \`true\``
      );

      return true;
    }

    console.warn(
      `[prefab] Still initializing... Comparing against defaultLogLevel setting: ${this.defaultLogLevel}`
    );

    this.telemetry.knownLoggers.push(loggerName, numericDesiredLevel);

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

  private loadingComplete(): void {
    this.lastUpdatedAt = Date.now();
    this.loading = false;
  }

  close(): void {
    if (this.sseConnection !== undefined && this.sseConnection !== null) {
      this.sseConnection.close();
      this.sseConnection = undefined;
    }
    if (this.pollTimeout !== undefined && this.pollTimeout !== null) {
      this.pollTimeout.unref();
    }

    // Clear all telemetry timeouts
    Object.values(this.telemetry).forEach((telemetryComponent) => {
      // First disable the component
      telemetryComponent.enabled = false;
      // Then clear its timeout
      if (telemetryComponent.timeout !== undefined) {
        clearTimeout(telemetryComponent.timeout);
        telemetryComponent.timeout = undefined;
      }
    });

    this.running = false;
  }

  addConfigChangeListener(callback: GlobalListenerCallback): () => void {
    return this.configChangeNotifier.addListener(callback);
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
  type Resolver,
  type ValidLogLevel,
  type ValidLogLevelName,
  wordLevelToNumber,
};
