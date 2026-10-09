/**
 * In-process token buckets for request-time search.
 *
 * Volatile by design: rate state survives nothing and stores nothing, which is
 * what keeps this on the right side of the minimization invariants — the abuse
 * layer records events, never traffic. The abuse-controls task composes with
 * this registry later; until then it is the only throttle in the portal.
 *
 * Pure and clock-injectable so the burst behaviour is testable without a
 * server, and the app wires the singleton through getSearchThrottle().
 */
export interface ThrottleOptions {
  /** Requests a caller may spend at once — the burst. */
  capacity: number;
  /** Tokens returned per minute, so sustained use stays modest. */
  refillPerMinute: number;
}

export interface Throttle {
  /**
   * Spend one token for `key` (an account id or network origin). `now` is
   * injectable so tests can advance time.
   */
  take(key: string, now?: number): { allowed: boolean; retryAfterSeconds: number };
}

export function createThrottle(options: ThrottleOptions): Throttle {
  // A refill of zero would strand an empty bucket forever; the floor keeps
  // every retry-after finite.
  const refillPerMinute = Math.max(1, options.refillPerMinute);
  const refillPerMs = refillPerMinute / 60_000;
  const state = new Map<string, { tokens: number; at: number }>();

  /** Keys are caller-supplied; the registry must not become a memory drain. */
  const MAX_KEYS = 10_000;

  return {
    take(key, now = Date.now()) {
      let bucket = state.get(key);
      if (!bucket) {
        if (state.size >= MAX_KEYS) {
          // Map preserves insertion order, so the oldest key is the first one.
          state.delete(state.keys().next().value!);
        }
        bucket = { tokens: options.capacity, at: now };
        state.set(key, bucket);
      }

      // Idle time refills up to the cap; it cannot bank extra burst.
      bucket.tokens = Math.min(options.capacity, bucket.tokens + (now - bucket.at) * refillPerMs);
      bucket.at = now;

      if (bucket.tokens < 1) {
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil((1 - bucket.tokens) / refillPerMs / 1000),
        };
      }
      bucket.tokens -= 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

/* The shared bucket for /api/search and the search page. Tuned for a person
 * typing queries, not a script: a small burst, then a steady trickle. */
const SEARCH_CAPACITY = 6;
const SEARCH_REFILL_PER_MINUTE = 12;

declare global {
  // eslint-disable-next-line no-var
  var __searchThrottle: Throttle | undefined;
}

/** Same instance for every caller in the process — the page and the API route must share one set of buckets. */
export function getSearchThrottle(): Throttle {
  // Survives hot reloads, which would otherwise hand the route a fresh bucket per edit.
  globalThis.__searchThrottle ??= createThrottle({
    capacity: SEARCH_CAPACITY,
    refillPerMinute: SEARCH_REFILL_PER_MINUTE,
  });
  return globalThis.__searchThrottle;
}
