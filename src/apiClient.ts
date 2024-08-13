import type { Fetch, FetchResult } from "./types";
import { makeHeaders } from "./makeHeaders";

interface SourceAndPath {
  path: string;
  source: string;
}

type InternalFetchArgs = SourceAndPath & { options?: Record<string, any> };

interface InternalFetch {
  fetch: (args: InternalFetchArgs) => FetchResult;
}

export const apiClient = (apiKey: string, fetchFunc: Fetch): InternalFetch => {
  const fetch = async ({
    path,
    source,
    options,
  }: InternalFetchArgs): FetchResult => {
    const opts = options ?? {};

    const headers = makeHeaders(apiKey, {
      ...(opts["headers"] ?? {}),
      "Content-Type": "application/x-protobuf",
      Accept: "application/x-protobuf",
    });

    return await fetchFunc(source + path, {
      ...opts,
      headers,
    });
  };
  return {
    fetch,
  };
};

export type ApiClient = ReturnType<typeof apiClient>;
