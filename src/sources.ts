const DEFAULT_SOURCES = [
  "https://belt.prefab.cloud",
  "https://suspenders.prefab.cloud",
];

class Sources {
  readonly sources: string[];
  readonly telemetrySource: string | undefined;
  readonly sseSources: string[];
  readonly configSources: string[];

  constructor(sources?: string[]) {
    this.sources = sources ?? DEFAULT_SOURCES;

    // trim any trailing slashes
    this.sources = this.sources.map((source) =>
      source.endsWith("/") ? source.slice(0, -1) : source
    );

    this.telemetrySource = this.sources
      .filter(
        (source) =>
          source.startsWith("https://") &&
          (source.includes("belt.") ||
            source.includes("suspenders.") ||
            source.includes("api."))
      )
      .map((source) =>
        source.replace(/(belt|suspenders|api)\./, "telemetry.")
      )[0];

    if (this.telemetrySource === undefined) {
      console.debug(
        `No telemetry source found in sources. No telemetry will be reported. Sources were ${JSON.stringify(
          this.sources
        )}`
      );
    }

    this.sseSources = this.sources;
    this.configSources = this.sources;
  }

  isEmpty(): boolean {
    return this.sources.length === 0;
  }
}

export { Sources, DEFAULT_SOURCES };
