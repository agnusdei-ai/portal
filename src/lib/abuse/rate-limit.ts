/**
 * The token buckets behind the edge throttle (spec art_ztdch8TP, "Layer 2 —
 * volume limits").
 *
 * The search and auth edges fail fast under load: a small burst is answered
 * with 429, and a caller that keeps arriving after that graduates to the
 * termination layer. The state lives in middleware memory and survives
 * nothing — a restart clears it, and each replica keeps its own — so rate
 * state is a tripwire, never a record.
 *
 * Import-free on purpose, like the other decision modules: the tests execute
 * these functions directly, with no build step and no vendor.
 */

export type BucketConfig = {
  /** Requests answered before throttling begins. */
  capacity: number;
  /** Tokens returned to the bucket per minute of quiet. */
  refillPerMinute: number;
};

export const EDGE_BUCKETS = {
  // Sign-in attempts: a person signs in once or twice; a script signs in a
  // thousand times. Capacity covers the odd double-submit and a family
  // sharing a connection, and little more.
  auth: { capacity: 10, refillPerMinute: 12 },
  // Federated search: an afternoon of browsing is dozens of queries, not
  // thousands. The bucket is also what keeps the relay from becoming a free
  // proxy for bulk harvesting.
  search: { capacity: 20, refillPerMinute: 30 },
} as const;

export type BucketName = keyof typeof EDGE_BUCKETS;

export type BucketState = {
  tokens: number;
  updatedAt: number;
  /** Consecutive arrivals at an empty bucket. Drives the escalation ladder. */
  strikes: number;
};

/**
 * The ladder from the spec's abuse section: the action is blocked, the
 * throttled caller sees 429, and a caller that keeps arriving has its
 * session terminated. Reaching this many strikes is the graduation.
 */
export type BucketOutcome = "allowed" | "throttled" | "terminate";

export const TERMINATION_STRIKES = 3;

/** One strike is forgiven for every five quiet minutes. */
const STRIKE_DECAY_MINUTES = 5;

/**
 * Brings a bucket up to `now`: refills tokens by elapsed time and ages the
 * strike memory. A bucket that has never been seen starts full.
 */
export function refilled(
  state: BucketState | undefined,
  now: number,
  cfg: BucketConfig,
): BucketState {
  if (!state) return { tokens: cfg.capacity, updatedAt: now, strikes: 0 };

  const minutes = Math.max(0, (now - state.updatedAt) / 60_000);
  const tokens = Math.min(cfg.capacity, state.tokens + minutes * cfg.refillPerMinute);
  // An allowed request does not forgive the throttle — the alternator (one
  // token, one burst) is exactly the automated rhythm this ladder exists to
  // end. Strikes wear off only through quiet minutes, not through usage.
  const strikes = Math.max(0, state.strikes - Math.floor(minutes / STRIKE_DECAY_MINUTES));
  return { tokens, updatedAt: now, strikes };
}

/**
 * Draws one token and returns the caller's outcome. The state comes back for
 * the caller to store; the outcome is one of the ladder's rungs.
 */
export function checkBucket(
  state: BucketState | undefined,
  now: number,
  cfg: BucketConfig,
): { state: BucketState; outcome: BucketOutcome } {
  const filled = refilled(state, now, cfg);

  if (filled.tokens >= 1) {
    return { state: { ...filled, tokens: filled.tokens - 1 }, outcome: "allowed" };
  }

  const strikes = filled.strikes + 1;
  return {
    state: { ...filled, strikes },
    outcome: strikes >= TERMINATION_STRIKES ? "terminate" : "throttled",
  };
}
