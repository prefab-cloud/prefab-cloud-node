import type Long from "long";

export type ContextValue = string | number | boolean | undefined;

type ContextName = string;

type ContextKey = string;

export type Context = Map<ContextKey, ContextValue>;

export type Contexts = Map<ContextName, Context>;

export type ProjectEnvId = Long;

export type HashByPropertyValue = string | undefined;

export type OnNoDefault = "error" | "warn" | "ignore";

export type FetchResult = Promise<{
  status: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
  [key: string]: any;
}>;

export type Fetch = (resource: any, options?: any) => FetchResult;
