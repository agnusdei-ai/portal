import { readdirSync } from "node:fs";
import { readStripped } from "./helpers.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * The prohibitions in locuto docs/portal.md are structural claims, and a
 * structural claim that nothing checks is a comment. compliance/parental-consent.md
 * §4 puts it directly: the schema must provide no column in which the forbidden
 * join could be expressed, "so that the separation is structural rather than
 * procedural."
 *
 * These tests fail the build if the schema regains the ability to express it.
 * They are deliberately crude string checks over the migration: a subtle test
 * would be one someone could argue with.
 */

const schema = readStripped(
  new URL("../supabase/migrations/0001_zones.sql", import.meta.url),
);

const tableNames = [...schema.matchAll(/create table (?:public\.|consent\.)?(\w+)/g)].map(
  (m) => m[1],
);

test("no table holds children", () => {
  const forbidden = ["students", "children", "child_profiles", "pupils"];
  for (const name of forbidden) {
    assert.ok(
      !tableNames.includes(name),
      `docs/portal.md §5: children live household-side. Found table "${name}".`,
    );
  }
});

test("no table expresses the child-to-curriculum join", () => {
  const forbidden = [
    "student_curricula",
    "child_curricula",
    "enrolments",
    "enrollments",
    "student_courses",
    "progress",
    "lesson_progress",
  ];
  for (const name of forbidden) {
    assert.ok(
      !tableNames.includes(name),
      `docs/portal.md §5: the child-to-curriculum join is household-only. Found table "${name}".`,
    );
  }
});

test("no table holds a co-op roster", () => {
  const forbidden = ["coop_memberships", "coop_members", "memberships", "rosters"];
  for (const name of forbidden) {
    assert.ok(
      !tableNames.includes(name),
      `docs/portal.md §10: a roster is an enumeration of people. Found table "${name}".`,
    );
  }
});

test("no column could hold a delivery identifier", () => {
  // compliance/parental-consent.md §4: the consent record is never joined to a
  // delivery identifier, and the schema must provide no column in which such a
  // join could be expressed.
  const forbidden = [
    /\bdelivery_id\b/,
    /\bdelivery_identifier\b/,
    /\brecipient_id\b/,
    /\benvelope_id\b/,
    /\bfingerprint\b/,
    /\bidentity_key\b/,
    /\bpublic_key\b/,
  ];
  for (const pattern of forbidden) {
    assert.ok(
      !pattern.test(schema),
      `parental-consent.md §4 forbids a column matching ${pattern}.`,
    );
  }
});

test("the consent record retains only what §4 lists", () => {
  const block = schema.slice(
    schema.indexOf("create table consent.consent_records"),
    schema.indexOf(");", schema.indexOf("create table consent.consent_records")),
  );

  // §4: "Not retained: the card number, expiry, security code, cardholder
  // address, or any portion of the card beyond what the processor's reference
  // implies."
  for (const banned of [
    "card_number",
    "pan",
    "expiry",
    "cvc",
    "security_code",
    "cardholder_address",
    "postal_code",
    "billing_address",
    "card_funding",
    "card_brand",
    "last4",
  ]) {
    assert.ok(
      !block.includes(banned),
      `parental-consent.md §4 does not retain "${banned}".`,
    );
  }
});

test("the consent record lives outside the API-reachable schema", () => {
  assert.ok(
    schema.includes("create schema if not exists consent"),
    "The consent record must sit in its own schema, unreachable through PostgREST.",
  );
  assert.ok(
    schema.includes("create table consent.consent_records"),
    "consent_records must be in the consent schema, not public.",
  );
});

test("a granted consent cannot exist without its evidence", () => {
  assert.ok(
    schema.includes("granted_is_evidenced"),
    "A consent recorded as granted without a processor reference is a consent we cannot evidence.",
  );
});

test("the excluded listing category stays excluded", () => {
  // docs/portal.md §8: nothing brokering an adult's access to a child.
  const categoryBlock = schema.slice(
    schema.indexOf("create type listing_category"),
    schema.indexOf(");", schema.indexOf("create type listing_category")),
  );
  for (const banned of ["tutoring", "childcare", "babysit", "transport", "carpool", "rideshare"]) {
    assert.ok(
      !categoryBlock.includes(banned),
      `docs/portal.md §8 excludes "${banned}" from the launch categories.`,
    );
  }
});

test("the licence is per seat, and a seat is never bought in bulk", () => {
  // compliance/parental-consent.md §3: consent is per child rather than per
  // household. counsel-packet-40 records that an institutionally purchased seat
  // breaks the payment-card consent method, so a quantity above one, or any
  // gift or bulk path, would take several children's consent in one transaction
  // naming one of them.
  const checkout = readStripped(new URL("../src/lib/billing/checkout.ts", import.meta.url));

  const quantities = [...checkout.matchAll(/quantity:\s*([^,\n]+)/g)].map((m) => m[1].trim());
  assert.deepEqual(quantities, ["1"], "Checkout must buy exactly one seat.");

  for (const banned of ["adjustable_quantity", "gift", "bulk", "seats:"]) {
    assert.ok(
      !checkout.includes(banned),
      `"${banned}" would create a purchase path that does not carry per-child consent.`,
    );
  }
});

test("a seat carries no attribute of the child", () => {
  const block = schema.slice(
    schema.indexOf("create table public.seats"),
    schema.indexOf(");", schema.indexOf("create table public.seats")),
  );
  for (const banned of ["name", "birth", "age", "grade", "curriculum"]) {
    assert.ok(
      !block.includes(banned),
      `A seat must not carry "${banned}". The child's name lives in the consent record and nowhere else.`,
    );
  }
});

// ===========================================================================
// Wave one of the security-and-resource-exchange spec (art_ztdch8TP):
// verification attestations, bookmarks, co-op meeting areas, abuse events.
//
// Same discipline as above: the spec's minimization promises are structural
// claims, and each one is pinned here so it cannot quietly stop being true.
// ===========================================================================

const migrationSql = new Map(
  readdirSync(new URL("../supabase/migrations/", import.meta.url))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => [f, readStripped(new URL(`../supabase/migrations/${f}`, import.meta.url))]),
);

function tableBlock(sql, header) {
  const start = sql.indexOf(header);
  assert.ok(start !== -1, `${header} not found in migrations`);
  return sql.slice(start, sql.indexOf(");", start));
}

function columnNames(block) {
  const tableLevel = new Set(["unique", "primary", "foreign", "constraint", "check", "exclude"]);
  return [...block.matchAll(/^ {2}(\w+)\s/gm)]
    .map((m) => m[1])
    .filter((name) => !tableLevel.has(name));
}

function assertColumns(block, allowed, label) {
  const actual = columnNames(block);
  const unexpected = actual.filter((c) => !allowed.has(c));
  assert.deepEqual(
    unexpected, [],
    `${label}: column not on the allowlist: ${unexpected.join(", ")}.`,
  );
  const missing = [...allowed].filter((c) => !actual.includes(c));
  assert.deepEqual(
    missing, [],
    `${label}: allowlisted column missing: ${missing.join(", ")}.`,
  );
}

test("the attestation stores an outcome, never an identity", () => {
  const block = tableBlock(
    migrationSql.get("0003_verification.sql"),
    "create table if not exists public.verification_attestations",
  );
  assertColumns(
    block,
    new Set([
      "id",
      "account_id",
      "method",
      "document_type",
      "vendor_evaluation_id",
      "docv_reference_id",
      "state",
      "reason_codes",
      "verified_at",
      "created_at",
    ]),
    "verification_attestations",
  );

  // The spec's minimization promise, named directly: identity PII transits the
  // portal to Socure and is never retained, in any spelling.
  for (const banned of [
    "name", "birth", "dob", "ssn", "social_security",
    "document_image", "document_number", "selfie", "photo", "image",
    "address", "email", "phone",
  ]) {
    assert.ok(
      !block.includes(banned),
      `verification_attestations must not hold "${banned}" — the portal relays identity PII to the vendor, it does not retain it.`,
    );
  }
});

test("the attestation is readable by its account and writable by nobody but the webhook", () => {
  const sql = migrationSql.get("0003_verification.sql");
  assert.ok(
    sql.includes("alter table public.verification_attestations enable row level security"),
    "The attestation must be row-level secured.",
  );
  const kinds = [
    ...sql.matchAll(/create policy "[^"]+" on public\.verification_attestations\s+for (\w+)/g),
  ].map((m) => m[1]);
  assert.deepEqual(
    kinds, ["select"],
    "The account reads its attestation; writes belong to the vendor-event webhook under the service role, so no client insert or update policy may exist.",
  );
});

test("the attestation policy resolves the account through its owner", () => {
  // The spec's phrasing — accounts.owner_user_id = auth.uid() — is the
  // definition of current_account_id() in 0001. Pin the helper, not a copy.
  const zones = migrationSql.get("0001_zones.sql");
  // Bound the region at the next function declaration, so the match cannot be
  // satisfied by a later policy that happens to repeat the phrase.
  const start = zones.indexOf("create or replace function public.current_account_id()");
  const region = zones.slice(start, zones.indexOf("create or replace function", start + 10));
  assert.ok(
    /owner_user_id = auth\.uid\(\)/.test(region),
    "current_account_id() must resolve accounts by owner_user_id = auth.uid().",
  );
});

test("bookmarks are private to the account that saved them", () => {
  const sql = migrationSql.get("0004_bookmarks.sql");
  assert.ok(
    sql.includes("alter table public.bookmarks enable row level security"),
    "Bookmarks must be row-level secured.",
  );
  assert.ok(
    /create policy "own bookmarks only" on public\.bookmarks\s+for all using \(account_id = current_account_id\(\)\)\s+with check \(account_id = current_account_id\(\)\)/.test(sql),
    "The only policy on bookmarks is ownership by the one account: no public read, no cross-account render.",
  );
});

test("coop_listings gains only coarse, optional meeting-area columns", () => {
  const sql = migrationSql.get("0005_coop_geo.sql");
  const added = [...sql.matchAll(/add column if not exists (\w+)/g)].map((m) => m[1]);
  assert.deepEqual(
    added, ["meeting_area_lat", "meeting_area_lng", "meeting_area_radius_mi"],
    "Only the metro-centroid pair and its tolerance may be added.",
  );
  for (const banned of ["address", "postcode", "postal", "zip", "street"]) {
    assert.ok(
      !sql.includes(banned),
      `docs/portal.md §7: a co-operative publishes a metro area, never "${banned}".`,
    );
  }
  assert.ok(
    !/add column if not exists \w+ [^,]*not null/i.test(sql),
    "A meeting area is a director's choice: the columns stay nullable so a region-only listing remains valid.",
  );
});

test("abuse_events is account-scoped and records no network identifier", () => {
  const block = tableBlock(
    migrationSql.get("0006_abuse.sql"),
    "create table if not exists public.abuse_events",
  );
  assertColumns(
    block,
    new Set(["id", "account_id", "kind", "action", "detail", "created_at"]),
    "abuse_events",
  );
  for (const banned of [
    /\bip\b/i,
    /ip_address/i,
    /remote_addr/i,
    /forwarded/i,
    /user_agent/i,
    /\bbody\b/i,
    /payload/i,
  ]) {
    assert.ok(
      !banned.test(block),
      `abuse_events must not record ${banned} — the record is account-scoped; an anonymous caller is a null account, not an address.`,
    );
  }
});

test("abuse events are readable only by the moderator surface", () => {
  const sql = migrationSql.get("0006_abuse.sql");
  assert.ok(
    sql.includes("alter table public.abuse_events enable row level security"),
    "Abuse events must be row-level secured.",
  );
  const kinds = [
    ...sql.matchAll(/create policy "[^"]+" on public\.abuse_events\s+for (\w+)/g),
  ].map((m) => m[1]);
  assert.deepEqual(
    kinds, ["select"],
    "No client writes an abuse event; only the moderator surface reads them.",
  );
  assert.ok(
    !sql.includes("using (true)"),
    "No broad public read of abuse events.",
  );
});

test("migrations create only the allowlisted tables", () => {
  const allow = new Set([
    // 0001
    "accounts", "seats", "user_roles", "notice_versions", "consent_records",
    "curricula", "resource_links", "coop_listings", "listings",
    "listing_replies", "listing_reports",
    // 0002
    "account_participants", "coop_affiliations", "permitted_axes",
    "communication_waivers", "payment_disputes",
    // wave one of the security-and-resource-exchange spec
    "verification_attestations", "bookmarks", "abuse_events",
  ]);
  const created = [...[...migrationSql.values()].join("\n").matchAll(
    /create table (?:if not exists )?(?:public\.|consent\.)?(\w+)/g,
  )].map((m) => m[1]);
  const unexpected = [...new Set(created)].filter((t) => !allow.has(t));
  assert.deepEqual(
    unexpected, [],
    `Table not on the allowlist: ${unexpected.join(", ")}. Federated search persists nothing — a results table would be the first leak.`,
  );
});

test("no search-result or query-log table exists anywhere", () => {
  const all = [...migrationSql.values()].join("\n");
  const found = [
    ...all.matchAll(/create table (?:if not exists )?(?:public\.|consent\.)?(\w*search\w*|\w*query_log\w*)/gi),
  ].map((m) => m[1]);
  assert.deepEqual(
    found, [],
    "The search route is an ephemeral relay: no results table, no query log, no click tracking.",
  );
});
