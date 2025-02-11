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
    const fullUrl = new URL(path, source).toString();
    return await fetchFunc(fullUrl, {
      ...opts,
      headers,
    });
  };
  return {
    fetch,
  };
};

export type ApiClient = ReturnType<typeof apiClient>;

const MAX_CACHE_ENTRIES = 10;
const cache = new Map<
  string,
  { data?: ArrayBuffer; etag?: string; expiresAt?: number }
>();
export function clearFetchCache(): void {
  cache.clear();
}

const fetchWithCache = async (
  apiClient: InternalFetch,
  { source, path, options }: InternalFetchArgs
): FetchResult => {
  const now = Date.now();
  const cacheKey = source + path;
  const cached = cache.get(cacheKey);

  if (
    cached?.data !== undefined &&
    cached.expiresAt !== undefined &&
    now < cached.expiresAt
  ) {
    return {
      status: 200,
      arrayBuffer: async () => {
        if (cached.data === undefined) {
          throw new Error("Cached data is unexpectedly undefined");
        }
        return cached.data;
      },
      headers: {
        get: (name: string) => (name === "ETag" ? cached.etag ?? null : null),
      },
    };
  }

  // ✅ Prepare headers for conditional requests
  const headers: Record<string, string> = { ...(options?.["headers"] ?? {}) };
  if (cached?.etag !== undefined) {
    headers["If-None-Match"] = cached.etag;
  }

  // 🔥 Fetch from the server
  const response = await apiClient.fetch({
    source,
    path,
    options: { ...options, headers },
  });

  // ✅ Explicitly assert `response.headers` as `Headers | undefined`
  const responseHeaders = response["headers"] as Headers | undefined;
  const cacheControl = responseHeaders?.get("Cache-Control") ?? "";
  const etag = responseHeaders?.get("ETag") ?? undefined;

  // 🚀 **Handle 304 Not Modified**
  if (response.status === 304 && cached?.data !== undefined) {
    return new Response(cached.data, {
      status: 200, // ✅ Convert 304 to 200 since we're serving cached data
      statusText: "OK",
      headers: new Headers({ ETag: cached.etag ?? "", "X-Cache": "HIT" }),
    });
  }

  // 🚫 Respect `no-store`: Do not cache this response
  if (cacheControl.includes("no-store")) {
    return response;
  }
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge =
    maxAgeMatch?.[1] !== undefined
      ? parseInt(maxAgeMatch[1], 10) * 1000
      : undefined;
  const expiresAt = maxAge !== undefined ? now + maxAge : undefined;

  // 🔥 Read response body
  const responseBuffer = await response.arrayBuffer();
  cache.set(cacheKey, { data: responseBuffer, etag, expiresAt });

  if (cache.size > MAX_CACHE_ENTRIES) {
    const leastUsedKey = cache.keys().next().value;
    cache.delete(leastUsedKey);
  }
  return new Response(responseBuffer, {
    status: response.status,
    statusText: response["statusText"],
    headers: response["headers"],
  });
};

export { fetchWithCache, type InternalFetchArgs };
