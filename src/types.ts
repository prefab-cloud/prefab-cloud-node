import type Long from "long";

export type ContextValue = string | number | boolean | undefined;

export type Context = Map<string, ContextValue>;

export type Contexts = Map<string, Context>;

export type ProjectEnvId = Long;

export type HashByPropertyValue = string | undefined;

export type OnNoDefault = "error" | "warn" | "ignore";
