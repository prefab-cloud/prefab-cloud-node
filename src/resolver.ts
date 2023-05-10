import type { Config } from "./proto";
import type { Context, Contexts, OnNoDefault, ProjectEnvId } from "./types";
import type { PrefabInterface } from "./prefab";

import { mergeContexts } from "./mergeContexts";

import type { GetValue } from "./unwrap";
import { evaluate } from "./evaluate";

const emptyContexts: Contexts = new Map<string, Context>();

const NOT_PROVIDED = Symbol("NOT_PROVIDED");

class Resolver implements PrefabInterface {
  private readonly config: Config[];
  private readonly projectEnvId: ProjectEnvId;
  private readonly namespace: string | undefined;
  private readonly onNoDefault: OnNoDefault;
  private readonly parentContext?: Contexts;

  constructor(
    config: Config[],
    projectEnvId: ProjectEnvId,
    namespace: string | undefined,
    onNoDefault: OnNoDefault,
    contexts?: Contexts
  ) {
    this.config = config;
    this.projectEnvId = projectEnvId;
    this.namespace = namespace;
    this.onNoDefault = onNoDefault;
    this.parentContext = contexts;
  }

  cloneWithContext(contexts: Contexts): Resolver {
    return new Resolver(
      this.config,
      this.projectEnvId,
      this.namespace,
      this.onNoDefault,
      contexts
    );
  }

  raw(key: string): Config | undefined {
    const config = this.config.find(({ key: configKey }) => {
      return key === configKey;
    });

    return config;
  }

  get(
    key: string,
    contexts?: Contexts,
    defaultValue: GetValue | symbol = NOT_PROVIDED
  ): GetValue {
    const config = this.raw(key);

    if (config === undefined) {
      if (defaultValue === NOT_PROVIDED) {
        if (this.onNoDefault === "error") {
          throw new Error(`No value found for key '${key}'`);
        }

        if (this.onNoDefault === "warn") {
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
