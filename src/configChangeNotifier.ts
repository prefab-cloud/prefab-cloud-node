import Long from "long";
import type { MinimumConfig } from "./resolver";
import { maxLong } from "./maxLong";

export interface ResolverInterface {
  keys: () => string[];
  raw: (key: string) => Pick<MinimumConfig, "id"> | undefined;
}

export type GlobalListenerCallback = () => void;

export class ConfigChangeNotifier {
  private readonly listeners: Set<GlobalListenerCallback> =
    new Set<GlobalListenerCallback>();

  private lastTotalId: Long = Long.ZERO;
  private resolver: ResolverInterface | undefined;

  /**
   * Initializes the notifier with a resolver instance.
   * This should be called after the Resolver has been instantiated,
   * typically passing this notifier's `handleResolverUpdate` to the Resolver's constructor.
   * @param resolver The resolver instance.
   */
  public init(resolver: ResolverInterface): void {
    // Allow re-initialization: always bind to the provided resolver
    // and recalculate the baseline based on its current state.
    this.resolver = resolver;
    this.lastTotalId = this.calculateCurrentTotalId();
  }

  /**
   * This method is designed to be used as the onUpdate callback for the Resolver.
   * It's called when the Resolver's configuration data has changed.
   *
   * It recalculates the total ID of all configurations and notifies listeners
   * if this total ID has changed.
   *
   * The `updatedConfigs` argument is not directly used to calculate the totalId,
   * as the notifier will query the resolver for the complete current state
   * to ensure accuracy.
   */
  public handleResolverUpdate = (): void => {
    if (this.resolver == null) {
      console.warn(
        "ConfigChangeNotifier.handleResolverUpdate called before init. Skipping."
      );
      return;
    }

    const newTotalId = this.calculateCurrentTotalId();

    if (!newTotalId.equals(this.lastTotalId)) {
      this.lastTotalId = newTotalId;
      this.notifyGlobalListeners();
    }
  };

  private readonly calculateCurrentTotalId = (): Long => {
    if (this.resolver == null) {
      return Long.ZERO;
    }

    const keys = this.resolver.keys();
    const ids: Long[] = [];

    for (const key of keys) {
      const config = this.resolver.raw(key);
      if (config?.id != null && Long.isLong(config.id)) {
        ids.push(config.id);
      }
    }

    return maxLong(ids);
  };

  private readonly notifyGlobalListeners = (): void => {
    [...this.listeners].forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error("Error executing global config change listener:", error);
      }
    });
  };

  /**
   * Adds a global listener that will be called when the total configuration ID changes.
   * @param callback The function to call.
   * @returns An unsubscribe function. Call this function to remove the listener.
   */
  public addListener = (callback: GlobalListenerCallback): (() => void) => {
    this.listeners.add(callback);
    return () => {
      this.removeListener(callback);
    };
  };

  /**
   * Removes a previously added global listener.
   * @param callback The exact callback function instance to remove.
   */
  public removeListener = (callback: GlobalListenerCallback): void => {
    this.listeners.delete(callback);
  };

  /**
   * Gets the last known total ID. Useful for debugging or specific checks.
   * @returns The last calculated total ID.
   */
  public getLastTotalId = (): Long => {
    return this.lastTotalId;
  };
}
