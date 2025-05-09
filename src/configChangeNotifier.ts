import Long from "long";
import type { Config } from "./proto"; // Adjust path if necessary
import type { MinimumConfig } from "./resolver"; // Corrected import for MinimumConfig
import { maxLong } from "./maxLong"; // Adjust path if necessary

// Define an interface for the parts of Resolver that ConfigChangeNotifier will use.
// This helps in decoupling and testing.
export interface ResolverInterface {
  keys: () => string[];
  // Assuming MinimumConfig has an optional `id` of type `Long`.
  // If MinimumConfig is not directly usable, this could be: raw: (key: string) => { id?: Long } | undefined;
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
  public handleResolverUpdate = (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _updatedConfigs: Array<Config | MinimumConfig>
  ): void => {
    if (this.resolver == null) {
      // This might happen if Resolver calls onUpdate before init is called,
      // though ideally init is called right after Resolver construction.
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
      // Should not happen if init is called properly.
      return Long.ZERO;
    }

    const keys = this.resolver.keys();
    const ids: Long[] = [];

    for (const key of keys) {
      const config = this.resolver.raw(key);
      // Ensure config exists, config.id exists, and config.id is a Long.
      // `MinimumConfig` might have `id` as optional or `Long | undefined`.
      if (config?.id != null && Long.isLong(config.id)) {
        ids.push(config.id);
      }
    }

    return maxLong(ids); // maxLong correctly returns Long.ZERO for an empty array.
  };

  private readonly notifyGlobalListeners = (): void => {
    // Iterate over a copy in case listeners modify the array during iteration
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
