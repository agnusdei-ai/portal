import { mergeHits } from "./merge";
import type { Throttle } from "./throttle";
import type { SearchHit, SearchProvider } from "./types";

/** A query is a relay, not a profile: cap it and forget it. */
export const MAX_QUERY_LENGTH = 200;

export type SearchOutcome =
  | { kind: "hits"; hits: SearchHit[]; failedProviders: string[] }
  | { kind: "rate_limited"; retryAfterSeconds: number }
  | { kind: "invalid_query" };

/** Every identity a caller carries gets a bucket; any refusal is the limit. */
export function throttleKeys(forwardedFor: string | undefined, userId: string | null): string[] {
  const ip = forwardedFor?.split(",")[0]?.trim();
  return [...(userId ? [`user:${userId}`] : []), ...(ip ? [`ip:${ip}`] : [])];
}

/**
 * The one search path — /api/search and the page both call this, so the two
 * surfaces cannot drift. Fans out to every provider, merges with attribution,
 * and persists nothing. A failing provider degrades the list rather than the
 * page: its id is reported so the caller can say which source is missing.
 */
export async function runSearch(args: {
  query: string;
  providers: SearchProvider[];
  throttle: Throttle;
  keys: string[];
}): Promise<SearchOutcome> {
  const query = args.query.trim().slice(0, MAX_QUERY_LENGTH);
  if (!query) return { kind: "invalid_query" };

  for (const key of args.keys) {
    const verdict = args.throttle.take(key);
    if (!verdict.allowed) {
      return { kind: "rate_limited", retryAfterSeconds: verdict.retryAfterSeconds };
    }
  }

  const settled = await Promise.allSettled(
    args.providers.map((p) => p.search(query, { signal: AbortSignal.timeout(10_000) })),
  );

  const failedProviders = settled.flatMap((r, i) =>
    r.status === "rejected" ? [args.providers[i].id] : [],
  );
  const hits = mergeHits(
    settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
    query,
  );
  return { kind: "hits", hits, failedProviders };
}
