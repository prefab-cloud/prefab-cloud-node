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

interface RawTestSuite {
  name: string;
  fileName: string;
  context: YAMLContext;
  cases: RawTestCase[];
}

interface RawTestCase {
  name: string;
  client: string;
  function: string;
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
    namespace: string | undefined;
    on_no_default: 2 | undefined;
  };
}

export interface Test {
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
    namespace: string | undefined;
    on_no_default: 2 | undefined;
  };
}

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

const calcExpectedValue = (testCase: RawTestCase, key: string): any => {
  let expectedValue = testCase.expected.value;

  if (expectedValue === null) {
    expectedValue = undefined;
  }

  if (key.startsWith(PREFIX)) {
    expectedValue = LogLevelLookup[expectedValue];
  }

  return expectedValue;
};

export const tests = (): Test[] => {
  const testSuites: RawTestSuite[] = [];

  fs.readdirSync(testsPath).forEach((file) => {
    if (file.endsWith(".yaml")) {
      testSuites.push(...testsFromYAML(file));
    }
  });

  return testSuites.flatMap((testSuite) => {
    return testSuite.cases.map((testCase) => {
      const name = [testSuite.fileName, testSuite.name, testCase.name]
        .filter((name) => name !== undefined)
        .join(" - ");

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

      return {
        name,
        parentContext,
        context,
        expectedWarning,
        client: testCase.client,
        function: testCase.function,
        input: { ...testCase.input, key },
        expected: { ...testCase.expected, value: expectedValue },
        client_overrides: testCase.client_overrides,
      };
    });
  });
};
