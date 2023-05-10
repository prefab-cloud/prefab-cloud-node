import { loadConfig } from "./loadConfig";
import { Resolver } from "./resolver";
import type { Contexts, OnNoDefault, ProjectEnvId } from "./types";

import type { Config } from "./proto";
import type { GetValue } from "./unwrap";

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
  namespace?: string;
  cdnUrl?: string;
  onNoDefault?: OnNoDefault;
}

class Prefab implements PrefabInterface {
  private readonly apiKey: string;
  private readonly namespace?: string;
  private resolver?: Resolver;
  private readonly cdnUrl: string;
  private readonly onNoDefault: "error" | "warn" | "ignore";

  constructor({ apiKey, namespace, cdnUrl, onNoDefault }: ConstructorProps) {
    this.apiKey = apiKey;
    this.namespace = namespace;
    this.cdnUrl = cdnUrl ?? "https://api-prefab-cloud.global.ssl.fastly.net";
    this.onNoDefault = onNoDefault ?? "error";
  }

  async init(): Promise<void> {
    const { configs, projectEnvId } = await loadConfig(
      this.apiKey,
      this.cdnUrl
    );

    this.setConfig(configs, projectEnvId);
  }

  setConfig(config: Config[], projectEnvId: ProjectEnvId): void {
    this.resolver = new Resolver(
      config,
      projectEnvId,
      this.namespace,
      this.onNoDefault
    );
  }

  inContext(contexts: Contexts, func: (prefab: Resolver) => void): void {
    requireResolver(this.resolver);

    func(this.resolver.cloneWithContext(contexts));
  }

  get(key: string, contexts?: Contexts, defaultValue?: GetValue): GetValue {
    requireResolver(this.resolver);

    return this.resolver.get(key, contexts, defaultValue);
  }

  isFeatureEnabled(key: string, contexts?: Contexts): boolean {
    requireResolver(this.resolver);

    return this.resolver.isFeatureEnabled(key, contexts);
  }
}

export { Prefab };
