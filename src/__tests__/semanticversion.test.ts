import { describe, test, expect } from "@jest/globals";
import SemanticVersion from "../semanticversion";

describe("SemanticVersion", () => {
  describe("parse valid versions", () => {
    interface TestCase {
      input: string;
      major: number;
      minor: number;
      patch: number;
      pre: string;
      build: string;
    }

    const tests: TestCase[] = [
      { input: "1.2.3", major: 1, minor: 2, patch: 3, pre: "", build: "" },
      { input: "0.0.0", major: 0, minor: 0, patch: 0, pre: "", build: "" },
      {
        input: "1.2.3-alpha",
        major: 1,
        minor: 2,
        patch: 3,
        pre: "alpha",
        build: "",
      },
      {
        input: "1.2.3+build.123",
        major: 1,
        minor: 2,
        patch: 3,
        pre: "",
        build: "build.123",
      },
      {
        input: "1.2.3-alpha.1+build.123",
        major: 1,
        minor: 2,
        patch: 3,
        pre: "alpha.1",
        build: "build.123",
      },
      {
        input: "10.20.30",
        major: 10,
        minor: 20,
        patch: 30,
        pre: "",
        build: "",
      },
      {
        input: "1.0.0-alpha.1",
        major: 1,
        minor: 0,
        patch: 0,
        pre: "alpha.1",
        build: "",
      },
      {
        input: "1.0.0-0.3.7",
        major: 1,
        minor: 0,
        patch: 0,
        pre: "0.3.7",
        build: "",
      },
      {
        input: "1.0.0-x.7.z.92",
        major: 1,
        minor: 0,
        patch: 0,
        pre: "x.7.z.92",
        build: "",
      },
    ];

    tests.forEach(({ input, major, minor, patch, pre, build }) => {
      test(`parses ${input} correctly`, () => {
        const v = SemanticVersion.parse(input);
        expect(v.getMajor()).toBe(major);
        expect(v.getMinor()).toBe(minor);
        expect(v.getPatch()).toBe(patch);
        expect(v.getPrerelease()).toBe(pre);
        expect(v.getBuildMetadata()).toBe(build);
      });
    });
  });

  describe("parse invalid versions", () => {
    const invalidVersions = [
      "",
      "1",
      "1.2",
      "1.2.3.4",
      "1.2.3-",
      "1.2.3+",
      "01.2.3",
      "1.02.3",
      "1.2.03",
      "-1.2.3",
      "1.-2.3",
      "1.2.-3",
    ];

    invalidVersions.forEach((version) => {
      test(`fails to parse ${version}`, () => {
        expect(() => SemanticVersion.parse(version)).toThrow();
      });
    });
  });

  describe("parseQuietly", () => {
    interface TestCase {
      input: string;
      wantNull: boolean;
    }

    const tests: TestCase[] = [
      { input: "1.2.3", wantNull: false },
      { input: "invalid", wantNull: true },
      { input: "", wantNull: true },
      { input: "1.2.3-alpha+build", wantNull: false },
    ];

    tests.forEach(({ input, wantNull }) => {
      test(`parseQuietly ${input}`, () => {
        const result = SemanticVersion.parseQuietly(input);
        expect(result === null).toBe(wantNull);
      });
    });
  });

  describe("compare", () => {
    interface TestCase {
      v1: string;
      v2: string;
      expected: number;
    }

    const tests: TestCase[] = [
      { v1: "1.2.3", v2: "1.2.3", expected: 0 },
      { v1: "2.0.0", v2: "1.9.9", expected: 1 },
      { v1: "1.2.3", v2: "1.2.4", expected: -1 },
      { v1: "1.2.3-alpha", v2: "1.2.3", expected: -1 },
      { v1: "1.2.3", v2: "1.2.3-beta", expected: 1 },
      { v1: "1.2.3-alpha", v2: "1.2.3-beta", expected: -1 },
      { v1: "1.0.0+build.1", v2: "1.0.0+build.2", expected: 0 },
      { v1: "2.1.1", v2: "2.1.0", expected: 1 },
      { v1: "2.1.1", v2: "2.2.0", expected: -1 },
      { v1: "1.0.0-alpha.1", v2: "1.0.0-alpha.2", expected: -1 },
      { v1: "1.0.0-alpha.2", v2: "1.0.0-alpha.11", expected: -1 },
      { v1: "1.0.0-2", v2: "1.0.0-11", expected: -1 },
      { v1: "1.0.0-alpha.1", v2: "1.0.0-beta.1", expected: -1 },
      { v1: "1.0.0-alpha.beta", v2: "1.0.0-beta.alpha", expected: -1 },
      { v1: "1.0.0-1", v2: "1.0.0-alpha", expected: -1 },
      { v1: "1.0.0-alpha", v2: "1.0.0-1", expected: 1 },
    ];

    tests.forEach(({ v1, v2, expected }) => {
      test(`compare ${v1} with ${v2}`, () => {
        const version1 = SemanticVersion.parse(v1);
        const version2 = SemanticVersion.parse(v2);
        expect(version1.compare(version2)).toBe(expected);
        if (expected !== 0) {
          expect(version2.compare(version1)).toBe(-expected);
        } else {
          expect(version2.compare(version1)).toBe(0);
        }
      });
    });
  });

  describe("equals", () => {
    interface TestCase {
      v1: string;
      v2: string;
      expected: boolean;
    }

    const tests: TestCase[] = [
      { v1: "1.2.3", v2: "1.2.3", expected: true },
      { v1: "1.2.3-alpha", v2: "1.2.3-alpha", expected: true },
      { v1: "1.2.3+build.1", v2: "1.2.3+build.2", expected: true },
      { v1: "1.2.3-alpha+build.1", v2: "1.2.3-alpha+build.2", expected: true },
      { v1: "1.2.3", v2: "1.2.4", expected: false },
      { v1: "1.2.3-alpha", v2: "1.2.3-beta", expected: false },
      { v1: "1.2.3", v2: "1.2.3-alpha", expected: false },
    ];

    tests.forEach(({ v1, v2, expected }) => {
      test(`equals ${v1} with ${v2}`, () => {
        const version1 = SemanticVersion.parse(v1);
        const version2 = SemanticVersion.parse(v2);
        expect(version1.equals(version2)).toBe(expected);
      });
    });
  });

  describe("toString", () => {
    interface TestCase {
      input: string;
      want: string;
    }

    const tests: TestCase[] = [
      { input: "1.2.3", want: "1.2.3" },
      { input: "1.2.3-alpha", want: "1.2.3-alpha" },
      { input: "1.2.3+build.123", want: "1.2.3+build.123" },
      { input: "1.2.3-alpha.1+build.123", want: "1.2.3-alpha.1+build.123" },
    ];

    tests.forEach(({ input, want }) => {
      test(`toString ${input}`, () => {
        const version = SemanticVersion.parse(input);
        expect(version.toString()).toBe(want);
      });
    });
  });
});
