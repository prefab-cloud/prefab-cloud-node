import type { Config, ConfigValue } from "./proto";
import { ConfigType } from "./proto";
import type {
  ContextObj,
  Context,
  Contexts,
  OnNoDefault,
  ProjectEnvId,
} from "./types";
import type { PrefabInterface, Telemetry } from "./prefab";

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

  const mergedContexts: Contexts = localContexts;

  for (const type of defaultContext.keys()) {
    mergedContexts.set(
      type,
      new Map(
        ...(localContexts.get(type) ?? new Map()),
        defaultContext.get(type) ?? new Map()
      )
    );
  }

  return mergedContexts;
};

class Resolver implements PrefabInterface {
  private readonly config: Map<string, MinimumConfig>;
  private readonly projectEnvId: ProjectEnvId;
  private readonly namespace: string | undefined;
  private readonly onNoDefault: OnNoDefault;
  private parentContext?: Contexts;
  private readonly telemetry: Telemetry | undefined;
  private readonly onUpdate: (configs: Config[]) => void;
  public readonly defaultContext?: Contexts;

  constructor(
    configs: Config[] | Map<string, MinimumConfig>,
    projectEnvId: ProjectEnvId,
    namespace: string | undefined,
    onNoDefault: OnNoDefault,
    telemetry?: Telemetry,
    contexts?: Contexts | ContextObj,
    onUpdate?: (configs: Config[]) => void,
    defaultContext?: Contexts
  ) {
    this.config = Array.isArray(configs)
      ? new Map(configs.map((config) => [config.key, config]))
      : configs;
    this.projectEnvId = projectEnvId;
    this.namespace = namespace;
    this.onNoDefault = onNoDefault;
    this.defaultContext = defaultContext ?? new Map();
    this.parentContext = mergeDefaultContexts(
      contexts ?? new Map(),
      defaultContext ?? new Map()
    );
    this.telemetry = telemetry;
    this.onUpdate = onUpdate ?? (() => {});
  }

  cloneWithContext(contexts: Contexts | ContextObj): Resolver {
    return new Resolver(
      this.config,
      this.projectEnvId,
      this.namespace,
      this.onNoDefault,
      this.telemetry,
      contexts,
      this.onUpdate,
      this.defaultContext
    );
  }

  update(configs: Config[], defaultContext?: Contexts): void {
    for (const config of configs) {
      this.config.set(config.key, config);
    }

    if (defaultContext !== undefined) {
      this.parentContext = mergeDefaultContexts(
        this.parentContext ?? new Map(),
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
    };

    this.config.set(key, config);
  }

  get(
    key: string,
    contexts?: Contexts | ContextObj,
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
      this.parentContext,
      contexts ?? emptyContexts
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
}

export { Resolver };
