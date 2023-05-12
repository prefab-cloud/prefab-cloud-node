import Long from "long";

export const maxLong = (longs: Long[]): Long => {
  return longs.reduce((max, long) => {
    if (long.greaterThan(max)) {
      return long;
    }

    return max;
  }, Long.ZERO);
};
