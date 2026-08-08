import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * The rule this file exists to defend: the platform carries adult-to-adult
 * communication only, and no child is a participant in any role on any axis.
 *
 * That is enforced by there being no participant class for a child, so no pair
 * in the axis table can contain one. These tests fail the build if a class or a
 * pair appears that would open a route to a child.
 */

const raw = readFileSync(
  new URL("../supabase/migrations/0002_participants.sql", import.meta.url),
  "utf8",
);
const schema = raw
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

const axesModule = readFileSync(
  new URL("../src/lib/exchange/axes.ts", import.meta.url),
  "utf8",
);

test("there is no participant class for a child", () => {
  const block = schema.slice(
    schema.indexOf("create type participant_class"),
    schema.indexOf(");", schema.indexOf("create type participant_class")),
  );
  for (const banned of ["child", "student", "pupil", "minor", "learner", "kid"]) {
    assert.ok(
      !block.includes(banned),
      `A participant class "${banned}" would open a route to a child. There must not be one.`,
    );
  }
  for (const expected of ["parent", "teacher", "guide", "coop"]) {
    assert.ok(block.includes(expected), `Expected the class "${expected}".`);
  }
});

test("the axis table holds exactly the agreed pairs", () => {
  const inserted = [
    ...schema.matchAll(/\('(\w+)',\s*'(\w+)',\s*'[^']*'\)/g),
  ].map(([, a, b]) => `${a}->${b}`);

  const expected = [
    "parent->parent",
    "parent->teacher",
    "teacher->parent",
    "guide->coop",
    "coop->guide",
  ];

  assert.deepEqual(
    inserted.sort(),
    expected.sort(),
    "The permitted axes must be exactly parent<->parent, parent<->teacher and guide<->coop.",
  );
});

test("the application mirror matches the database", () => {
  // Scoped to the PERMITTED_AXES literal: CATEGORY_CLASSES lower down is also a
  // list of class pairs and is a different thing entirely.
  const block = axesModule.slice(
    axesModule.indexOf("PERMITTED_AXES"),
    axesModule.indexOf("];", axesModule.indexOf("PERMITTED_AXES")),
  );
  const pairs = [...block.matchAll(/\["(\w+)",\s*"(\w+)"\]/g)].map(
    ([, a, b]) => `${a}->${b}`,
  );
  assert.deepEqual(
    pairs.sort(),
    ["parent->parent", "parent->teacher", "teacher->parent", "guide->coop", "coop->guide"].sort(),
    "src/lib/exchange/axes.ts has drifted from the axis table.",
  );
});

test("replies are checked against the axes in the database, not only the app", () => {
  assert.ok(
    schema.includes("create trigger listing_replies_axis"),
    "An application-only check is a claim about the deployed code. The trigger is the enforcement.",
  );
  assert.ok(
    schema.includes("create trigger listings_class"),
    "Posting must be checked in the database too.",
  );
});

test("teacher and guide require a co-operative's vouch", () => {
  assert.ok(schema.includes("coop_affiliations"), "The vouch table must exist.");
  assert.ok(
    /class in \('teacher', 'guide'\)/.test(schema),
    "Only teacher and guide are vouched classes.",
  );
  assert.ok(
    schema.includes("a teacher or guide is reachable only through a co-operative"),
    "Posting as teacher or guide must require an unrevoked vouch.",
  );
});

test("the vouch table is not a member roster", () => {
  // docs/portal.md §10 forbids a roster of member families. A vouch names an
  // adult acting publicly for a named institution, which is a different object,
  // and the difference collapses if the table grows a family column.
  const block = schema.slice(
    schema.indexOf("create table public.coop_affiliations"),
    schema.indexOf(");", schema.indexOf("create table public.coop_affiliations")),
  );
  for (const banned of ["family", "household", "child", "student", "member_of"]) {
    assert.ok(
      !block.includes(banned),
      `A vouch must not carry "${banned}" or it becomes the roster §10 prohibits.`,
    );
  }
});

test("communication requires an accepted waiver", () => {
  assert.ok(schema.includes("communication_waivers"), "The waiver table must exist.");
  assert.ok(
    (schema.match(/the communication waiver has not been accepted/g) ?? []).length >= 2,
    "Both posting and replying must require the waiver.",
  );
});

test("a disputed charge suspends the seat it paid for", () => {
  assert.ok(schema.includes("payment_disputes"), "Disputes must be recorded.");
  assert.ok(schema.includes("suspended_at"), "A seat must be suspendable.");
  assert.ok(
    schema.includes("add value if not exists 'disputed'"),
    "A consent whose charge was disputed is no longer evidenced and must be markable as such.",
  );
});
