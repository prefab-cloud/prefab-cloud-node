import type { Config } from "./proto";
import type { Context, Contexts, OnNoDefault, ProjectEnvId } from "./types";
import type { PrefabInterface, Telemetry } from "./prefab";

import { mergeContexts } from "./mergeContexts";

import type { GetValue } from "./unwrap";
import { evaluate } from "./evaluate";

const emptyContexts: Contexts = new Map<string, Context>();

export const NOT_PROVIDED = Symbol("NOT_PROVIDED");

class Resolver implements PrefabInterface {
  private readonly config: Map<string, Config>;
  private readonly projectEnvId: ProjectEnvId;
  private readonly namespace: string | undefined;
  private readonly onNoDefault: OnNoDefault;
  private readonly parentContext?: Contexts;
  private readonly telemetry: Telemetry | undefined;

  constructor(
    configs: Config[] | Map<string, Config>,
    projectEnvId: ProjectEnvId,
    namespace: string | undefined,
    onNoDefault: OnNoDefault,
    telemetry?: Telemetry,
    contexts?: Contexts
  ) {
    this.config = Array.isArray(configs)
      ? new Map(configs.map((config) => [config.key, config]))
      : configs;
    this.projectEnvId = projectEnvId;
    this.namespace = namespace;
    this.onNoDefault = onNoDefault;
    this.parentContext = contexts;
    this.telemetry = telemetry;
  }

  cloneWithContext(contexts: Contexts): Resolver {
    return new Resolver(
      this.config,
      this.projectEnvId,
      this.namespace,
      this.onNoDefault,
      this.telemetry,
      contexts
    );
  }

  update(configs: Config[]): void {
    for (const config of configs) {
      this.config.set(config.key, config);
    }
  }

  raw(key: string): Config | undefined {
    return this.config.get(key);
  }

  get(
    key: string,
    contexts?: Contexts,
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

    if (this.telemetry !== undefined) {
      this.telemetry.contextShapes.push(mergedContexts);
      this.telemetry.exampleContexts.push(mergedContexts);
    }

    return evaluate({
      config,
      projectEnvId: this.projectEnvId,
      namespace: this.namespace,
      contexts: mergedContexts,
      resolver: this,
    });
  }

  isFeatureEnabled(key: string, contexts?: Contexts): boolean {
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
}

export { Resolver };
