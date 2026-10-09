import { test } from "node:test";
import assert from "node:assert/strict";

import { createThrottle } from "../src/lib/search/throttle.ts";

test("a burst beyond capacity is refused with a retry-after", () => {
  const throttle = createThrottle({ capacity: 5, refillPerMinute: 60 });
  const t0 = 1_000_000;

  for (let i = 0; i < 5; i++) {
    assert.equal(throttle.take("ip:1", t0).allowed, true);
  }
  const refused = throttle.take("ip:1", t0);
  assert.equal(refused.allowed, false);
  assert.ok(Number.isFinite(refused.retryAfterSeconds) && refused.retryAfterSeconds > 0);
});

test("buckets are per caller", () => {
  const throttle = createThrottle({ capacity: 1, refillPerMinute: 60 });
  const t0 = 1_000_000;
  assert.equal(throttle.take("user:a", t0).allowed, true);
  assert.equal(throttle.take("user:b", t0).allowed, true);
  assert.equal(throttle.take("user:a", t0).allowed, false);
});

test("tokens refill over time and never bank beyond capacity", () => {
  const throttle = createThrottle({ capacity: 2, refillPerMinute: 1 }); // 1 token per 60s
  const t0 = 1_000_000;

  assert.equal(throttle.take("ip:1", t0).allowed, true);
  assert.equal(throttle.take("ip:1", t0).allowed, true);
  assert.equal(throttle.take("ip:1", t0).allowed, false);

  // 90s later: one refilled token.
  assert.equal(throttle.take("ip:1", t0 + 90_000).allowed, true);
  assert.equal(throttle.take("ip:1", t0 + 90_000).allowed, false);
});

test("idle time does not bank extra burst", () => {
  const throttle = createThrottle({ capacity: 2, refillPerMinute: 60 });
  const t0 = 1_000_000;

  assert.equal(throttle.take("ip:1", t0).allowed, true);
  assert.equal(throttle.take("ip:1", t0).allowed, true);
  // An hour idle: at most `capacity` tokens, never more.
  assert.equal(throttle.take("ip:1", t0 + 3_600_000).allowed, true);
  assert.equal(throttle.take("ip:1", t0 + 3_600_000).allowed, true);
  assert.equal(throttle.take("ip:1", t0 + 3_600_000).allowed, false);
});
