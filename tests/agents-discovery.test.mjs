import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_LIMIT,
  DEFAULT_LIMIT,
  discoverTutors,
  parseLimit,
} from "@/lib/agents/discovery";

/**
 * Vetted tutor discovery and the response shape (spec art_ztdch8TP, tutor
 * persona row; acceptance rows "verified + AAL2 fixture → discovery payload"
 * and "response-shape test asserting no PII fields leak into any payload").
 *
 * The fixtures are the rows RLS yields to a caller's own session — active
 * vouches, listed co-ops, the closed axis table — so the tests exercise the
 * same facts the route reads, and the shape assertions pin the payload to an
 * exact allowlist.
 */

const AXES = [
  { a: "parent", b: "parent", note: "" },
  { a: "parent", b: "teacher", note: "" },
  { a: "teacher", b: "parent", note: "" },
  { a: "guide", b: "coop", note: "" },
  { a: "coop", b: "guide", note: "" },
].map(({ a, b }) => ({ a, b }));

const COOPS = [
  { id: "coop-1", slug: "riverbend", name: "Riverbend Co-op", state_code: "TX", region: "Houston metro" },
  { id: "coop-2", slug: "prairie", name: "Prairie Learning Co-op", state_code: null, region: null },
];

function input(overrides = {}) {
  return {
    callerAccountId: "caller",
    callerClasses: ["parent"],
    vouches: [],
    coops: COOPS,
    axes: AXES,
    ...overrides,
  };
}

// ===========================================================================
// The axis rule: trust data travels only where communication already may.
// ===========================================================================

test("a parent principal sees a vouched teacher", () => {
  const tutors = discoverTutors(input({
    vouches: [{ account_id: "acc-teacher", class: "teacher", vouched_at: "2026-10-01T00:00:00Z", coop_listing_id: "coop-1" }],
  }));
  assert.equal(tutors.length, 1);
  assert.equal(tutors[0].account_id, "acc-teacher");
  assert.deepEqual(tutors[0].classes, ["teacher"]);
  assert.deepEqual(tutors[0].axes, [{ a: "parent", b: "teacher" }]);
});

test("a vouched guide is invisible to a parent — no parent↔guide axis exists", () => {
  const tutors = discoverTutors(input({
    vouches: [{ account_id: "acc-guide", class: "guide", vouched_at: "2026-10-01T00:00:00Z", coop_listing_id: "coop-1" }],
  }));
  assert.deepEqual(tutors, []);
});

test("a co-op principal sees a vouched guide", () => {
  const tutors = discoverTutors(input({
    callerClasses: ["coop"],
    vouches: [{ account_id: "acc-guide", class: "guide", vouched_at: "2026-10-01T00:00:00Z", coop_listing_id: "coop-1" }],
  }));
  assert.equal(tutors.length, 1);
  assert.deepEqual(tutors[0].axes, [{ a: "coop", b: "guide" }]);
});

test("the caller never discovers itself", () => {
  const tutors = discoverTutors(input({
    vouches: [{ account_id: "caller", class: "teacher", vouched_at: "2026-10-01T00:00:00Z", coop_listing_id: "coop-1" }],
  }));
  assert.deepEqual(tutors, []);
});

// ===========================================================================
// Grouping, visibility, ordering, limiting.
// ===========================================================================

test("two co-op vouches for one account become one hit, newest first", () => {
  const tutors = discoverTutors(input({
    vouches: [
      { account_id: "acc-1", class: "teacher", vouched_at: "2026-09-01T00:00:00Z", coop_listing_id: "coop-1" },
      { account_id: "acc-1", class: "teacher", vouched_at: "2026-10-01T00:00:00Z", coop_listing_id: "coop-2" },
    ],
  }));
  assert.equal(tutors.length, 1);
  assert.deepEqual(tutors[0].classes, ["teacher"]);
  assert.equal(tutors[0].vouches.length, 2);
  // Newest vouch first within the hit.
  assert.equal(tutors[0].vouches[0].coop.id, "coop-2");
});

test("a vouch behind a co-op invisible to the caller is dropped", () => {
  // RLS only yields listed co-ops; a fixture co-op row that is missing stands
  // in for an unlisted one. The API asserts no fact it cannot see.
  const tutors = discoverTutors(input({
    vouches: [{ account_id: "acc-1", class: "teacher", vouched_at: "2026-10-01T00:00:00Z", coop_listing_id: "coop-unlisted" }],
  }));
  assert.deepEqual(tutors, []);
});

test("hits order by newest vouch, then account id, deterministically", () => {
  const tutors = discoverTutors(input({
    vouches: [
      { account_id: "acc-b", class: "teacher", vouched_at: "2026-09-15T00:00:00Z", coop_listing_id: "coop-1" },
      { account_id: "acc-a", class: "teacher", vouched_at: "2026-09-15T00:00:00Z", coop_listing_id: "coop-1" },
      { account_id: "acc-c", class: "teacher", vouched_at: "2026-10-01T00:00:00Z", coop_listing_id: "coop-1" },
    ],
  }));
  assert.deepEqual(tutors.map((t) => t.account_id), ["acc-c", "acc-a", "acc-b"]);
});

test("the limit slices the ordered hits", () => {
  const vouches = ["1", "2", "3"].map((n) => ({
    account_id: `acc-${n}`,
    class: "teacher",
    vouched_at: `2026-09-0${n}T00:00:00Z`,
    coop_listing_id: "coop-1",
  }));
  assert.equal(discoverTutors(input({ vouches }), 2).length, 2);
  assert.equal(discoverTutors(input({ vouches })).length, 3);
});

test("an empty board returns an empty payload, not an error", () => {
  assert.deepEqual(discoverTutors(input()), []);
});

// ===========================================================================
// parseLimit — refused, not clamped.
// ===========================================================================

test("the limit parses to the default, a valid number, or a refusal", () => {
  assert.equal(parseLimit(null), DEFAULT_LIMIT);
  assert.equal(parseLimit(""), DEFAULT_LIMIT);
  assert.equal(parseLimit("25"), 25);
  assert.equal(parseLimit(String(MAX_LIMIT)), MAX_LIMIT);
  assert.equal(parseLimit("0"), "invalid-limit");
  assert.equal(parseLimit(String(MAX_LIMIT + 1)), "invalid-limit");
  assert.equal(parseLimit("abc"), "invalid-limit");
  assert.equal(parseLimit("-1"), "invalid-limit");
  assert.equal(parseLimit("1.5"), "invalid-limit");
});

// ===========================================================================
// Response shape: the payload is an exact allowlist, and the forbidden words
// never appear as keys anywhere in it.
// ===========================================================================

const FORBIDDEN_KEYS = [
  "email", "phone", "first_name", "last_name", "full_name", "name_person",
  "dob", "date_of_birth", "birthdate", "birthday", "ssn", "social_security",
  "address", "street", "postcode", "postal_code", "zip",
  "document_number", "document_image", "selfie", "photo", "image",
  "owner_user_id", "vendor_evaluation_id", "docv_reference_id", "reason_codes",
  "enquiry_ref", "licence_token", "token", "secret", "child", "child_account_name",
  "ip", "user_agent", "listing_replies", "replies", "message", "messages",
];

function collectKeys(value, path, out) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, path, out));
    return out;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      out.push(`${path}.${key}`);
      collectKeys(inner, `${path}.${key}`, out);
    }
  }
  return out;
}

test("the discovery payload is exactly the allowlisted shape", () => {
  const tutors = discoverTutors(input({
    callerClasses: ["parent", "teacher"],
    vouches: [
      { account_id: "acc-1", class: "teacher", vouched_at: "2026-10-01T00:00:00Z", coop_listing_id: "coop-1" },
      { account_id: "acc-1", class: "guide", vouched_at: "2026-09-01T00:00:00Z", coop_listing_id: "coop-2" },
      { account_id: "acc-2", class: "teacher", vouched_at: "2026-08-01T00:00:00Z", coop_listing_id: "coop-1" },
    ],
  }));
  const payload = {
    principal: { account_id: "caller", verification_state: "verified", classes: ["parent", "teacher"] },
    tutors,
  };

  // Exact key sets at each level — anything added later must argue its way in.
  assert.deepEqual(Object.keys(payload), ["principal", "tutors"]);
  assert.deepEqual(Object.keys(payload.principal), ["account_id", "verification_state", "classes"]);
  for (const hit of payload.tutors) {
    assert.deepEqual(Object.keys(hit), ["account_id", "classes", "vouches", "axes"]);
    for (const vouch of hit.vouches) {
      assert.deepEqual(Object.keys(vouch), ["class", "vouched_at", "coop"]);
      assert.deepEqual(Object.keys(vouch.coop), ["id", "slug", "name", "state_code", "region"]);
    }
    for (const axis of hit.axes) {
      assert.deepEqual(Object.keys(axis), ["a", "b"]);
    }
  }
});

test("no PII field name appears anywhere in the payload", () => {
  const tutors = discoverTutors(input({
    vouches: [
      { account_id: "acc-1", class: "teacher", vouched_at: "2026-10-01T00:00:00Z", coop_listing_id: "coop-1" },
      { account_id: "acc-2", class: "teacher", vouched_at: "2026-08-01T00:00:00Z", coop_listing_id: "coop-2" },
    ],
  }));
  const payload = {
    principal: { account_id: "caller", verification_state: "verified", classes: ["parent"] },
    tutors,
  };

  const keys = collectKeys(payload, "$", []);
  for (const key of keys) {
    const leaf = key.split(".").pop();
    assert.ok(
      !FORBIDDEN_KEYS.includes(leaf),
      `The payload must never carry a "${leaf}" field — found at ${key}.`,
    );
  }

  // The only person-adjacent word the payload may hold at all is the
  // institution's own name, which the public directory already publishes.
  const names = keys.filter((key) => key.endsWith(".name"));
  for (const name of names) {
    assert.ok(
      /\.coop\.name$/.test(name),
      `A name field may only appear under a co-op, never a person — found at ${name}.`,
    );
  }
});
