const semverPattern =
  /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

class SemanticVersion {
  private readonly major: number;
  private readonly minor: number;
  private readonly patch: number;
  private readonly prerelease: string;
  private readonly buildMetadata: string;

  constructor(
    major: number,
    minor: number,
    patch: number,
    prerelease: string = "",
    buildMetadata: string = ""
  ) {
    this.major = major;
    this.minor = minor;
    this.patch = patch;
    this.prerelease = prerelease;
    this.buildMetadata = buildMetadata;
  }

  public getMajor(): number {
    return this.major;
  }

  public getMinor(): number {
    return this.minor;
  }

  public getPatch(): number {
    return this.patch;
  }

  public getPrerelease(): string {
    return this.prerelease;
  }

  public getBuildMetadata(): string {
    return this.buildMetadata;
  }

  public static parse(version: string): SemanticVersion {
    if (version === "") {
      throw new Error("version string cannot be empty");
    }

    const match = version.match(semverPattern);
    if (match === null || match.groups === null) {
      throw new Error(`invalid semantic version format: ${version}`);
    }

    const groups = match.groups as Record<string, string>;
    const { major, minor, patch, prerelease, buildmetadata } = groups;
    if (major === undefined || minor === undefined || patch === undefined) {
      throw new Error(`invalid semantic version format: ${version}`);
    }

    return new SemanticVersion(
      parseInt(major, 10),
      parseInt(minor, 10),
      parseInt(patch, 10),
      prerelease ?? "",
      buildmetadata ?? ""
    );
  }

  public static parseQuietly(version: string): SemanticVersion | null {
    try {
      return SemanticVersion.parse(version);
    } catch {
      return null;
    }
  }

  private static isNumeric(value: string): boolean {
    const num = Number(value);
    return !Number.isNaN(num) && Number.isFinite(num);
  }

  private static comparePreReleaseIdentifiers(
    id1: string,
    id2: string
  ): number {
    if (this.isNumeric(id1) && this.isNumeric(id2)) {
      const num1 = parseInt(id1, 10);
      const num2 = parseInt(id2, 10);
      return num1 === num2 ? 0 : num1 < num2 ? -1 : 1;
    }

    if (this.isNumeric(id1)) return -1;
    if (this.isNumeric(id2)) return 1;

    return id1 === id2 ? 0 : id1 < id2 ? -1 : 1;
  }

  private static comparePreRelease(pre1: string, pre2: string): number {
    if (pre1 === "" && pre2 === "") return 0;
    if (pre1 === "") return 1;
    if (pre2 === "") return -1;

    const ids1 = pre1.split(".");
    const ids2 = pre2.split(".");
    const minLen = Math.min(ids1.length, ids2.length);

    for (let i = 0; i < minLen; i++) {
      const s1 = ids1[i];
      const s2 = ids2[i];
      if (typeof s1 !== "string" || typeof s2 !== "string") {
        throw new Error("Invalid prerelease format");
      }
      const cmp = this.comparePreReleaseIdentifiers(s1, s2);
      if (cmp !== 0) return cmp;
    }

    return ids1.length === ids2.length ? 0 : ids1.length < ids2.length ? -1 : 1;
  }

  public compare(other: SemanticVersion): number {
    if (this.major !== other.major) {
      return this.major > other.major ? 1 : -1;
    }

    if (this.minor !== other.minor) {
      return this.minor > other.minor ? 1 : -1;
    }

    if (this.patch !== other.patch) {
      return this.patch > other.patch ? 1 : -1;
    }

    return SemanticVersion.comparePreRelease(this.prerelease, other.prerelease);
  }

  public toString(): string {
    let result = `${this.major}.${this.minor}.${this.patch}`;
    if (this.prerelease !== "") {
      result += `-${this.prerelease}`;
    }
    if (this.buildMetadata !== "") {
      result += `+${this.buildMetadata}`;
    }
    return result;
  }

  public equals(other: SemanticVersion): boolean {
    return (
      this.major === other.major &&
      this.minor === other.minor &&
      this.patch === other.patch &&
      this.prerelease === other.prerelease
    );
  }
}

export default SemanticVersion;
