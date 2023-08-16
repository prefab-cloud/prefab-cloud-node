import fs from "fs";
import type { Contexts } from "../types";
import { PREFIX } from "../logger";

const YAML = require("yaml");

const testDataPath = `./prefab-cloud-integration-test-data`;

const version = fs.readFileSync(`${testDataPath}/version`).toString().trim();

const testsPath = `${testDataPath}/tests/${version}`;

const expectedWarnings: Record<string, RegExp> = {
  "always returns false for a non-boolean flag":
    /Non-boolean FF's return `false` for isFeatureEnabled checks./,
};

const LogLevelLookup: Record<string, number> = {
  TRACE: 1,
  DEBUG: 2,
  INFO: 3,
  WARN: 5,
  ERROR: 6,
  FATAL: 9,
};

type YAMLContext = Record<string, Record<string, any>> | undefined;

type RawAggregator = "log_path" | "context_shape";

type Aggregator = "knownLoggers" | "contextShapes";

interface RawTestSuite {
  name: string;
  fileName: string;
  context: YAMLContext;
  cases: Array<RawInputOutputTestCase | RawTelemetryTestCase>;
}

interface RawInputOutputTestCase {
  name: string;
  client: string;
  function: "enabled" | "get" | "get_or_raise";
  input: {
    key?: string;
    flag?: string;
    default?: any;
    context: YAMLContext;
  };
  expected: {
    value: any;
    status?: "raise";
    message?: string;
  };
  client_overrides: {
    namespace?: string;
    on_no_default?: 2;
  };
}

interface RawTelemetryTestCase {
  name: string;
  client: string;
  function: "post";
  data: Record<string, any>;
  expected_data: Record<string, any>;
  aggregator: RawAggregator;
  client_overrides: {
    collect_sync_interval?: number;
    context_upload_mode?: string;
  };
}

export interface InputOutputTest {
  name: string;
  parentContext: Contexts | undefined;
  context: Contexts | undefined;
  client: string;
  function: string;
  expectedWarning: RegExp | undefined;
  input: {
    key?: string;
    flag?: string;
    default?: any;
    context?: Record<string, Record<string, any>>;
  };
  expected: {
    value: any;
    status?: "raise";
    message?: string;
  };
  client_overrides: {
    namespace?: string;
    on_no_default?: 2;
  };
}

export interface TelemetryTest {
  name: string;
  data: Record<string, any>;
  function: "post";
  expectedTelemetryData: Record<string, any>;
  aggregator: Aggregator;
  client_overrides: {
    collect_sync_interval?: number;
    context_upload_mode?: string;
  };
}

const aggregatorLookup: Record<RawAggregator, Aggregator> = {
  log_path: "knownLoggers",
  context_shape: "contextShapes",
};

const formatContext = (
  context: Record<string, Record<string, any>>
): Contexts => {
  const builder: Contexts = new Map();

  Object.entries(context).forEach(([key, value]) => {
    builder.set(key, new Map(Object.entries(value)));
  });

  return builder;
};

const testsFromYAML = (fileName: string): RawTestSuite[] => {
  return YAML.parse(
    fs.readFileSync(`${testsPath}/${fileName}`, "utf8")
  ).tests.map((suite: RawTestSuite[]) => {
    return { ...suite, fileName };
  });
};

const contextMaybe = (context: YAMLContext): Contexts | undefined => {
  return context !== undefined ? formatContext(context) : undefined;
};

const calcExpectedValue = (
  testCase: RawInputOutputTestCase,
  key: string
): any => {
  if (testCase.expected === undefined) {
    return undefined;
  }

  let expectedValue = testCase.expected.value;

  if (expectedValue === null) {
    expectedValue = undefined;
  }

  if (key.startsWith(PREFIX)) {
    expectedValue = LogLevelLookup[expectedValue];
  }

  return expectedValue;
};

export const tests = (): {
  inputOutputTests: InputOutputTest[];
  telemetryTests: TelemetryTest[];
} => {
  const testSuites: RawTestSuite[] = [];

  fs.readdirSync(testsPath).forEach((file) => {
    if (file.endsWith(".yaml")) {
      testSuites.push(...testsFromYAML(file));
    }
  });

  const telemetryTests: TelemetryTest[] = [];
  const inputOutputTests: InputOutputTest[] = [];

  testSuites.forEach((testSuite) => {
    testSuite.cases.forEach((testCase) => {
      const name = [testSuite.fileName, testSuite.name, testCase.name]
        .filter((name) => name !== undefined)
        .join(" - ");

      if (testCase.function === "post") {
        telemetryTests.push({
          name,
          function: testCase.function,
          data: testCase.data,
          expectedTelemetryData: testCase.expected_data,
          client_overrides: testCase.client_overrides,
          aggregator: aggregatorLookup[testCase.aggregator],
        });

        return;
      }

      const parentContext = contextMaybe(testSuite.context);

      const context = contextMaybe(testCase.input.context);

      const key = testCase.input.key ?? testCase.input.flag ?? "";

      const expectedValue = calcExpectedValue(testCase, key);

      const expectedWarning =
        expectedWarnings[
          Object.keys(expectedWarnings).find((str: string) =>
            name.includes(str)
          ) ?? ""
        ];

      inputOutputTests.push({
        name,
        parentContext,
        context,
        expectedWarning,
        client: testCase.client,
        function: testCase.function,
        input: { ...testCase.input, key },
        expected: { ...testCase.expected, value: expectedValue },
        client_overrides: testCase.client_overrides,
      });
    });
  });

  return {
    telemetryTests,
    inputOutputTests,
  };
};
