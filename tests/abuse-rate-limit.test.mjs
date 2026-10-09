import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { loadModule, readStripped } from "./helpers.mjs";

/**
 * The throttle and the termination ladder (spec art_ztdch8TP, "Layer 2" and
 * "Layer 3"). The buckets run with a mocked clock; the termination runs
 * against a mocked Supabase admin client, so the revocation call and the
 * abuse_events row are asserted, not assumed. The middleware wiring is
 * checked structurally, the way the idle sign-out is.
 */
const buckets = loadModule(new URL("../src/lib/abuse/rate-limit.ts", import.meta.url));
const events = loadModule(new URL("../src/lib/abuse/events.ts", import.meta.url));

// --------------------------------------------------------------------------
// Buckets — block, throttle, escalate.
// --------------------------------------------------------------------------

const cfg = { capacity: 5, refillPerMinute: 30 };

function exhaust(now) {
  let state;
  for (let i = 0; i < cfg.capacity; i++) {
    ({ state } = buckets.checkBucket(state, now, cfg));
  }
  return state;
}

test("a fresh bucket allows a burst up to capacity, then throttles", () => {
  let state = exhaust(1000);
  let outcome;
  ({ state, outcome } = buckets.checkBucket(state, 1001, cfg));
  assert.equal(outcome, "throttled");
});

test("tokens refill with quiet time", () => {
  const state = exhaust(1000);
  const after = buckets.refilled(state, 1000 + 60_000, cfg);
  assert.equal(after.tokens, cfg.capacity, "one quiet minute refills past capacity; it is capped");
});

test("a caller that keeps tripping the bucket is terminated on the third strike", () => {
  let state = exhaust(1000);
  let outcome;
  ({ state, outcome } = buckets.checkBucket(state, 1001, cfg));
  assert.equal(outcome, "throttled", "strike 1 throttles");
  ({ state, outcome } = buckets.checkBucket(state, 1002, cfg));
  assert.equal(outcome, "throttled", "strike 2 throttles");
  ({ state, outcome } = buckets.checkBucket(state, 1003, cfg));
  assert.equal(outcome, "terminate", "strike 3 terminates");
});

test("an allowed request does not forgive the throttle — the alternator is caught", () => {
  // One drip at a time: the caller paces itself so each attempt finds
  // exactly one fresh token. Strikes climb through the allowed gaps until
  // the ladder ends it — an allowed request forgives nothing.
  let state = exhaust(1000);
  let outcome;
  for (let strike = 1; strike <= buckets.TERMINATION_STRIKES; strike++) {
    ({ state, outcome } = buckets.checkBucket(state, 1001, cfg));
    if (strike < buckets.TERMINATION_STRIKES) {
      assert.equal(outcome, "throttled", `strike ${strike} throttles`);
      // One fresh token drips in at the same instant — no decay, no drift.
      state = { ...state, tokens: 1 };
      ({ state, outcome } = buckets.checkBucket(state, 1001, cfg));
      assert.equal(outcome, "allowed", `the drip gets in, round ${strike}`);
    } else {
      assert.equal(outcome, "terminate", `strike ${strike} terminates`);
    }
  }
  assert.equal(state.strikes, buckets.TERMINATION_STRIKES);
  assert.equal(outcome, "terminate");
});

test("strikes wear off only through quiet minutes, not through usage", () => {
  let state = exhaust(1000);
  ({ state } = buckets.checkBucket(state, 1001, cfg)); // strike 1
  ({ state } = buckets.checkBucket(state, 1002, cfg)); // strike 2

  const decayed = buckets.refilled(state, 1002 + 4 * 60_000, cfg);
  assert.equal(decayed.strikes, 2, "four quiet minutes forgive nothing yet");

  const rested = buckets.refilled(state, 1002 + 10 * 60_000, cfg);
  assert.equal(rested.strikes, 0, "ten quiet minutes forgive both strikes");
});

test("the shipped edges both have sane buckets", () => {
  for (const [name, edgeCfg] of Object.entries(buckets.EDGE_BUCKETS)) {
    assert.ok(edgeCfg.capacity >= 1, `${name} allows at least one request`);
    assert.ok(edgeCfg.refillPerMinute > 0, `${name} refills`);
  }
  assert.ok(buckets.TERMINATION_STRIKES >= 2, "termination takes more than one stumble");
});

// --------------------------------------------------------------------------
// Termination — revoke the session, record the event, surface every failure.
// --------------------------------------------------------------------------

function fakeAdmin() {
  const calls = { signOut: [], inserts: [] };
  return {
    calls,
    auth: {
      admin: {
        signOut: async (sessionId) => {
          calls.signOut.push(sessionId);
          return { error: null };
        },
      },
    },
    from: (table) => ({
      insert: async (row) => {
        calls.inserts.push({ table, row });
        return { error: null };
      },
    }),
  };
}

test("termination revokes the session and records session_terminated", async () => {
  const admin = fakeAdmin();
  const result = await events.terminateAbusiveSession(admin, {
    sessionId: "sess-77",
    accountId: "acc-9",
    detail: { edge: "search", strikes: 3 },
  });

  assert.equal(result.revoked, true);
  assert.equal(result.recorded, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(admin.calls.signOut, ["sess-77"]);
  assert.deepEqual(admin.calls.inserts, [
    {
      table: "abuse_events",
      row: {
        account_id: "acc-9",
        kind: "rate_limit",
        action: "session_terminated",
        detail: { edge: "search", strikes: 3 },
      },
    },
  ]);
});

test("an anonymous caller is recorded as blocked — nothing to revoke", async () => {
  const admin = fakeAdmin();
  const result = await events.terminateAbusiveSession(admin, {
    sessionId: null,
    accountId: null,
  });

  assert.equal(result.revoked, false);
  assert.deepEqual(admin.calls.signOut, []);
  assert.equal(admin.calls.inserts[0].row.action, "blocked");
  assert.equal(admin.calls.inserts[0].row.account_id, null);
});

test("a failed revocation is recorded as blocked and the error comes back", async () => {
  const admin = fakeAdmin();
  admin.auth.admin.signOut = async () => ({ error: { message: "session not found" } });

  const result = await events.terminateAbusiveSession(admin, {
    sessionId: "sess-77",
    accountId: "acc-9",
  });

  assert.equal(result.revoked, false);
  assert.equal(result.recorded, true, "the record is written even when the revoke fails");
  assert.equal(result.errors.length, 1);
  assert.ok(result.errors[0].includes("session not found"));
  assert.equal(admin.calls.inserts[0].row.action, "blocked");
});

// --------------------------------------------------------------------------
// Session id from the access token claim.
// --------------------------------------------------------------------------

function jwtWithClaims(claims) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `eyJhbGciOiJIUzI1NiJ9.${enc(claims)}.sig`;
}

test("the session id is read from the access-token claim", () => {
  assert.equal(events.sessionIdFromAccessToken(jwtWithClaims({ session_id: "sess-42" })), "sess-42");
});

test("a token without the claim, or not a token at all, gives nothing to revoke", () => {
  assert.equal(events.sessionIdFromAccessToken(jwtWithClaims({ sub: "u" })), null);
  assert.equal(events.sessionIdFromAccessToken("garbage"), null);
  assert.equal(events.sessionIdFromAccessToken(null), null);
  assert.equal(events.sessionIdFromAccessToken(undefined), null);
});

// --------------------------------------------------------------------------
// Middleware wiring.
// --------------------------------------------------------------------------

const middleware = readStripped(new URL("../src/middleware.ts", import.meta.url));

test("the throttle covers the search and auth edges and answers before auth routing", () => {
  for (const prefix of ['"/api/search"', '"/auth"', '"/login"']) {
    assert.ok(middleware.includes(prefix), `the throttle must cover ${prefix}`);
  }
  assert.ok(middleware.includes("status: 429"), "a throttled caller sees 429");
  assert.ok(
    middleware.indexOf("throttledEdge(pathname)") < middleware.indexOf("PROTECTED_PREFIXES.some"),
    "a throttled caller is answered before any auth routing happens",
  );
});

test("escalation terminates through the admin client and records the event", () => {
  assert.ok(middleware.includes("terminateAbusiveSession("), "the escalation path terminates");
  assert.ok(middleware.includes("createAdminClient("), "via the service-role client");
  assert.ok(middleware.includes("sessionIdFromAccessToken("), "keyed on the token's session claim");
  assert.ok(middleware.includes("buckets.set("), "bucket state is in middleware memory");
});
