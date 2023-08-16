interface RateLimitCache {
  isFresh: (key: string) => boolean;
  set: (key: string) => void;
  prune: () => void;
}

export const rateLimitCache = (duration: number): RateLimitCache => {
  const data = new Map<string, number>();

  return {
    isFresh(key: string) {
      const timestamp = data.get(key);

      if (timestamp === undefined) {
        return false;
      }

      return Date.now() - timestamp <= duration;
    },

    set(key: string) {
      data.set(key, Date.now());
    },

    prune() {
      const now = Date.now();

      for (const [key, timestamp] of data.entries()) {
        if (now - timestamp > duration) {
          data.delete(key);
        }
      }
    },
  };
};
