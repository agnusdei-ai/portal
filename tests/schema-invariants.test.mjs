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
