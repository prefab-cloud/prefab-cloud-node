/* eslint-disable */
import Long from "long";
import _m0 from "protobufjs/minimal";

export const protobufPackage = "prefab";

export enum ConfigType {
  /** NOT_SET_CONFIG_TYPE - proto null */
  NOT_SET_CONFIG_TYPE = 0,
  CONFIG = 1,
  FEATURE_FLAG = 2,
  LOG_LEVEL = 3,
  SEGMENT = 4,
  LIMIT_DEFINITION = 5,
  UNRECOGNIZED = -1,
}

export enum LogLevel {
  NOT_SET_LOG_LEVEL = 0,
  TRACE = 1,
  DEBUG = 2,
  INFO = 3,
  /** WARN - NOTICE = 4; */
  WARN = 5,
  ERROR = 6,
  /**
   * FATAL - CRITICAL = 7;
   * ALERT = 8;
   */
  FATAL = 9,
  UNRECOGNIZED = -1,
}

export enum OnFailure {
  NOT_SET = 0,
  LOG_AND_PASS = 1,
  LOG_AND_FAIL = 2,
  THROW = 3,
  UNRECOGNIZED = -1,
}

export interface ConfigServicePointer {
  projectId: Long;
  startAtId: Long;
  projectEnvId: Long;
}

export interface ConfigValue {
  int?: Long | undefined;
  string?: string | undefined;
  bytes?: Buffer | undefined;
  double?: number | undefined;
  bool?: boolean | undefined;
  weightedValues?: WeightedValues | undefined;
  limitDefinition?: LimitDefinition | undefined;
  logLevel?: LogLevel | undefined;
  stringList?: StringList | undefined;
  intRange?: IntRange | undefined;
}

export interface IntRange {
  /** if empty treat as Long.MIN_VALUE. Inclusive */
  start?:
    | Long
    | undefined;
  /** if empty treat as Long.MAX_VALUE. Exclusive */
  end?: Long | undefined;
}

export interface StringList {
  values: string[];
}

export interface WeightedValue {
  /** out of 1000 */
  weight: number;
  value: ConfigValue | undefined;
}

export interface WeightedValues {
  weightedValues: WeightedValue[];
  hashByPropertyName?: string | undefined;
}

export interface Configs {
  configs: Config[];
  configServicePointer: ConfigServicePointer | undefined;
}

export interface Config {
  id: Long;
  projectId: Long;
  key: string;
  changedBy: ChangedBy | undefined;
  rows: ConfigRow[];
  allowableValues: ConfigValue[];
  configType: ConfigType;
  draftId?: Long | undefined;
}

export interface ChangedBy {
  userId: Long;
  email: string;
}

export interface ConfigRow {
  /** one row per project_env_id */
  projectEnvId?: Long | undefined;
  values: ConditionalValue[];
  /** can store "activated" */
  properties: { [key: string]: ConfigValue };
}

export interface ConfigRow_PropertiesEntry {
  key: string;
  value: ConfigValue | undefined;
}

export interface ConditionalValue {
  /** if all criteria match, then the rule is matched and value is returned */
  criteria: Criterion[];
  value: ConfigValue | undefined;
}

export interface Criterion {
  propertyName: string;
  operator: Criterion_CriterionOperator;
  valueToMatch: ConfigValue | undefined;
}

export enum Criterion_CriterionOperator {
  /** NOT_SET - proto null */
  NOT_SET = 0,
  LOOKUP_KEY_IN = 1,
  LOOKUP_KEY_NOT_IN = 2,
  IN_SEG = 3,
  NOT_IN_SEG = 4,
  ALWAYS_TRUE = 5,
  PROP_IS_ONE_OF = 6,
  PROP_IS_NOT_ONE_OF = 7,
  PROP_ENDS_WITH_ONE_OF = 8,
  PROP_DOES_NOT_END_WITH_ONE_OF = 9,
  HIERARCHICAL_MATCH = 10,
  IN_INT_RANGE = 11,
  UNRECOGNIZED = -1,
}

export interface Loggers {
  loggers: Logger[];
  startAt: Long;
  endAt: Long;
  /** random UUID generated on startup - represents the server so we can aggregate */
  instanceHash: string;
  namespace?: string | undefined;
}

export interface Logger {
  loggerName: string;
  traces?: Long | undefined;
  debugs?: Long | undefined;
  infos?: Long | undefined;
  warns?: Long | undefined;
  errors?: Long | undefined;
  fatals?: Long | undefined;
}

export interface LoggerReportResponse {
}

export interface LimitResponse {
  passed: boolean;
  /** for returnable: rtn this value */
  expiresAt: Long;
  /** events:pageview:homepage:123123 */
  enforcedGroup: string;
  currentBucket: Long;
  /** events:pageview */
  policyGroup: string;
  policyName: LimitResponse_LimitPolicyNames;
  policyLimit: number;
  amount: Long;
  limitResetAt: Long;
  safetyLevel: LimitDefinition_SafetyLevel;
}

export enum LimitResponse_LimitPolicyNames {
  NOT_SET = 0,
  SECONDLY_ROLLING = 1,
  MINUTELY_ROLLING = 3,
  HOURLY_ROLLING = 5,
  DAILY_ROLLING = 7,
  MONTHLY_ROLLING = 8,
  INFINITE = 9,
  YEARLY_ROLLING = 10,
  UNRECOGNIZED = -1,
}

export interface LimitRequest {
  accountId: Long;
  acquireAmount: number;
  groups: string[];
  limitCombiner: LimitRequest_LimitCombiner;
  allowPartialResponse: boolean;
  /** [default = L4_BEST_EFFORT]; */
  safetyLevel: LimitDefinition_SafetyLevel;
}

export enum LimitRequest_LimitCombiner {
  NOT_SET = 0,
  MINIMUM = 1,
  MAXIMUM = 2,
  UNRECOGNIZED = -1,
}

/** if the same Context type exists, last one wins */
export interface ContextSet {
  contexts: Context[];
}

export interface Context {
  type?: string | undefined;
  values: { [key: string]: ConfigValue };
}

export interface Context_ValuesEntry {
  key: string;
  value: ConfigValue | undefined;
}

export interface Identity {
  lookup?: string | undefined;
  attributes: { [key: string]: string };
}

export interface Identity_AttributesEntry {
  key: string;
  value: string;
}

export interface ClientConfigValue {
  int?: Long | undefined;
  string?: string | undefined;
  double?: number | undefined;
  bool?: boolean | undefined;
}

export interface ConfigEvaluations {
  values: { [key: string]: ClientConfigValue };
}

export interface ConfigEvaluations_ValuesEntry {
  key: string;
  value: ClientConfigValue | undefined;
}

export interface LimitDefinition {
  policyName: LimitResponse_LimitPolicyNames;
  limit: number;
  burst: number;
  accountId: Long;
  lastModified: Long;
  returnable: boolean;
  /** [default = L4_BEST_EFFORT]; // Overridable by request */
  safetyLevel: LimitDefinition_SafetyLevel;
}

export enum LimitDefinition_SafetyLevel {
  NOT_SET = 0,
  L4_BEST_EFFORT = 4,
  L5_BOMBPROOF = 5,
  UNRECOGNIZED = -1,
}

export interface LimitDefinitions {
  definitions: LimitDefinition[];
}

export interface BufferedRequest {
  accountId: Long;
  method: string;
  uri: string;
  body: string;
  limitGroups: string[];
  contentType: string;
  fifo: boolean;
}

export interface BatchRequest {
  accountId: Long;
  method: string;
  uri: string;
  body: string;
  limitGroups: string[];
  batchTemplate: string;
  batchSeparator: string;
}

export interface BasicResponse {
  message: string;
}

export interface CreationResponse {
  message: string;
  newId: Long;
}

export interface IdBlock {
  projectId: Long;
  projectEnvId: Long;
  sequenceName: string;
  start: Long;
  end: Long;
}

export interface IdBlockRequest {
  projectId: Long;
  projectEnvId: Long;
  sequenceName: string;
  size: Long;
}

export interface ContextShape {
  name: string;
  fieldTypes: { [key: string]: number };
}

export interface ContextShape_FieldTypesEntry {
  key: string;
  value: number;
}

export interface ContextShapes {
  shapes: ContextShape[];
  namespace?: string | undefined;
}

export interface EvaluatedKeys {
  keys: string[];
  namespace?: string | undefined;
}

export interface EvaluatedConfig {
  key: string;
  configVersion: Long;
  result: ConfigValue | undefined;
  context: ContextSet | undefined;
  timestamp: Long;
}

export interface EvaluatedConfigs {
  configs: EvaluatedConfig[];
}

if (_m0.util.Long !== Long) {
  _m0.util.Long = Long as any;
  _m0.configure();
}
