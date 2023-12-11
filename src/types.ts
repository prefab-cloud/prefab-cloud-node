import type Long from "long";

export type ContextValue = unknown;

type ContextName = string;

type ContextKey = string;

export type Context = Map<ContextKey, ContextValue>;

export type Contexts = Map<ContextName, Context>;

export type ContextObj = Record<string, Record<string, unknown>>;

export type ProjectEnvId = Long;

export type HashByPropertyValue = string | undefined;

export type OnNoDefault = "error" | "warn" | "ignore";

export type FetchResult = Promise<{
  status: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
  [key: string]: any;
}>;

export type Fetch = (resource: any, options?: any) => FetchResult;

export const isNonNullable = <T>(value: T): value is NonNullable<T> => {
  return value !== null && value !== undefined;
};
