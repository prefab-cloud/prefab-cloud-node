import type { Fetch, FetchResult } from "./types";
import { makeHeaders } from "./makeHeaders";

type UrlOrPath =
  | {
      path: string;
      url?: never;
    }
  | {
      path?: never;
      url: string;
    };

type InternalFetchArgs = UrlOrPath & { options?: Record<string, any> };

interface InternalFetch {
  fetch: (args: InternalFetchArgs) => FetchResult;
}

export const apiClient = (
  apiUrl: string,
  apiKey: string,
  fetch: Fetch
): InternalFetch => {
  return {
    fetch: async ({ path, url, options }: InternalFetchArgs): FetchResult => {
      const opts = options ?? {};

      const headers = makeHeaders(apiKey, {
        ...(opts["headers"] ?? {}),
        "Content-Type": "application/x-protobuf",
        Accept: "application/x-protobuf",
      });

      return await fetch(url ?? apiUrl + path, {
        ...opts,
        headers,
      });
    },
  };
};

export type ApiClient = ReturnType<typeof apiClient>;
