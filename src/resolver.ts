import type { Config, ConfigValue } from "./proto";
import { shouldLog, makeLogger, parseLevel } from "./logger";
import type { ValidLogLevelName, ValidLogLevel } from "./logger";
import { ConfigType } from "./proto";
import type {
  ContextObj,
  Context,
  Contexts,
  OnNoDefault,
  ProjectEnvId,
} from "./types";
import type { PrefabInterface, Telemetry } from "./prefab";
import { PREFAB_DEFAULT_LOG_LEVEL } from "./prefab";

import { mergeContexts, contextObjToMap } from "./mergeContexts";

import type { GetValue } from "./unwrap";
import { configValueType } from "./wrap";
import { evaluate } from "./evaluate";

const emptyContexts: Contexts = new Map<string, Context>();

export const NOT_PROVIDED = Symbol("NOT_PROVIDED");

type OptionalKeys = "id" | "projectId" | "changedBy" | "allowableValues";

export type MinimumConfig = {
  [K in keyof Config]: K extends OptionalKeys
    ? Config[K] | undefined
    : Config[K];
};

const mergeDefaultContexts = (
  contexts: Contexts | ContextObj,
  defaultContext: Contexts
): Contexts => {
  const localContexts =
    contexts instanceof Map ? contexts : contextObjToMap(contexts);

  const mergedContexts: Contexts = new Map(localContexts);

  for (const type of defaultContext.keys()) {
    const defaultSingleContext: Context = defaultContext.get(type) ?? new Map();

    const mergedContext = new Map(localContexts.get(type) ?? new Map());

    defaultSingleContext.forEach((value, key) => {
      mergedContext.set(key, value);
    });

    mergedContexts.set(type, mergedContext);
  }

  return mergedContexts;
};

let id = 0;

class Resolver implements PrefabInterface {
  private readonly config = new Map<string, MinimumConfig>();
  private readonly projectEnvId: ProjectEnvId;
  private readonly namespace: string | undefined;
  private readonly onNoDefault: OnNoDefault;
  public contexts?: Contexts;
  readonly telemetry: Telemetry | undefined;
  private readonly onUpdate: (configs: Array<Config | MinimumConfig>) => void;
  public id: number;
  public readonly defaultContext?: Contexts;
  public updateIfStalerThan: (
    durationInMs: number
  ) => Promise<void> | undefined;

  constructor(
    configs: Config[] | Map<string, MinimumConfig>,
    projectEnvId: ProjectEnvId,
    namespace: string | undefined,
    onNoDefault: OnNoDefault,
    updateIfStalerThan: (durationInMs: number) => Promise<void> | undefined,
    telemetry?: Telemetry,
    contexts?: Contexts | ContextObj,
    onUpdate?: (configs: Array<Config | MinimumConfig>) => void,
    defaultContext?: Contexts
  ) {
    id += 1;
    this.id = id;
    this.projectEnvId = projectEnvId;
    this.namespace = namespace;
    this.onNoDefault = onNoDefault;
    this.onUpdate = onUpdate ?? (() => {});
    this.update(
      Array.isArray(configs) ? configs : Array.from(configs.values()),
      defaultContext
    );
    this.contexts = mergeDefaultContexts(
      contexts ?? new Map(),
      defaultContext ?? new Map()
    );
    this.telemetry = telemetry;
    this.updateIfStalerThan = updateIfStalerThan;
  }

  cloneWithContext(contexts: Contexts | ContextObj): Resolver {
    return new Resolver(
      this.config,
      this.projectEnvId,
      this.namespace,
      this.onNoDefault,
      this.updateIfStalerThan,
      this.telemetry,
      contexts,
      this.onUpdate,
      this.defaultContext
    );
  }

  update(
    configs: Array<Config | MinimumConfig>,
    defaultContext?: Contexts
  ): void {
    for (const config of configs) {
      if (config.configType !== ConfigType.DELETED) {
        this.config.set(config.key, config);
      }
    }

    if (defaultContext !== undefined) {
      this.contexts = mergeDefaultContexts(
        this.contexts ?? new Map(),
        defaultContext
      );
    }

    this.onUpdate(configs);
  }

  raw(key: string): MinimumConfig | undefined {
    return this.config.get(key);
  }

  set(key: string, value: ConfigValue): void {
    const valueType = configValueType(value);

    if (!valueType) {
      throw new Error(`Unknown value type for ${JSON.stringify(value)}`);
    }

    const config: MinimumConfig = {
      id: undefined,
      projectId: undefined,
      changedBy: undefined,
      allowableValues: undefined,
      key,
      rows: [{ properties: {}, values: [{ value, criteria: [] }] }],
      configType: ConfigType.CONFIG,
      valueType,
      sendToClientSdk: false,
    };

    this.config.set(key, config);
  }

  get(
    key: string,
    localContexts?: Contexts | ContextObj,
    defaultValue: GetValue | symbol = NOT_PROVIDED,
    onNoDefault: OnNoDefault = this.onNoDefault
  ): GetValue {
    const config = this.raw(key);

    if (config === undefined) {
      if (defaultValue === NOT_PROVIDED) {
        if (onNoDefault === "error") {
          throw new Error(`No value found for key '${key}'`);
        }

        if (onNoDefault === "warn") {
          console.warn(`No value found for key '${key}'`);
        }

        return undefined;
      }

      return defaultValue as GetValue;
    }

    const mergedContexts = mergeContexts(
      this.contexts,
      localContexts ?? emptyContexts
    );

    if (this.telemetry !== undefined && config.id !== undefined) {
      this.telemetry.contextShapes.push(mergedContexts);
      this.telemetry.exampleContexts.push(mergedContexts);
    }

    const evaluation = evaluate({
      config,
      projectEnvId: this.projectEnvId,
      namespace: this.namespace,
      contexts: mergedContexts,
      resolver: this,
    });

    if (this.telemetry !== undefined && config.id !== undefined) {
      this.telemetry.evaluationSummaries.push(evaluation);
    }

    return evaluation.unwrappedValue;
  }

  isFeatureEnabled(key: string, contexts?: Contexts | ContextObj): boolean {
    const value = this.get(key, contexts);

    if (typeof value === "boolean") {
      return value;
    }

    if (value === "true" || value === "false") {
      return value === "true";
    }

    console.warn(
      `Expected boolean value for key ${key}, got ${typeof value}. Non-boolean FF's return \`false\` for isFeatureEnabled checks.`
    );
    return false;
  }

  keys(): string[] {
    return Array.from(this.config.keys());
  }

  logger(
    loggerName: string,
    defaultLevel: ValidLogLevelName | ValidLogLevel,
    contexts?: Contexts | ContextObj
  ): ReturnType<typeof makeLogger> {
    const parsedDefaultLevel = parseLevel(defaultLevel);

    if (parsedDefaultLevel === undefined) {
      throw new Error(`Invalid default level: ${defaultLevel}`);
    }

    return makeLogger({
      loggerName,
      defaultLevel: parsedDefaultLevel,
      contexts: contexts ?? this.contexts,
      resolver: this,
    });
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

    if (this.telemetry != null) {
      this.telemetry.knownLoggers.push(loggerName, numericDesiredLevel);
    }

    return shouldLog({
      loggerName,
      desiredLevel: numericDesiredLevel,
      contexts: contexts ?? this.contexts,
      defaultLevel: parseLevel(defaultLevel) ?? PREFAB_DEFAULT_LOG_LEVEL,
      resolver: this,
    });
  }
}

export { Resolver };
