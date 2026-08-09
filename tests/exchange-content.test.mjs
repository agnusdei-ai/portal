import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * docs/portal.md §7's prohibitions on listing content. The module is TypeScript,
 * so the patterns are read out of it rather than imported, which keeps the test
 * runnable with plain `node --test` and no build step.
 */
const source = readFileSync(
  new URL("../src/lib/exchange/schema.ts", import.meta.url),
  "utf8",
);

function extractRegexes(label) {
  const block = source.slice(source.indexOf(label));
  return [...block.matchAll(/\/((?:[^/\\\n]|\\.)+)\/([gimsuy]*)/g)]
    .slice(0, 6)
    .map(([, body, flags]) => new RegExp(body, flags));
}

const contactPatterns = extractRegexes("const CONTACT_PATTERNS");

function flagged(text) {
  return contactPatterns.some((r) => r.test(text));
}

test("an email address in a listing is caught", () => {
  assert.ok(flagged("Saxon 7/6, email me at jane.doe@example.com"));
});

test("a telephone number is caught in the formats people write", () => {
  assert.ok(flagged("Call 555-123-4567 about the microscope"));
  assert.ok(flagged("(555) 123 4567"));
  assert.ok(flagged("+1 555 123 4567"));
});

test("a messaging link is caught", () => {
  assert.ok(flagged("find me at t.me/somebody"));
  assert.ok(flagged("https://wa.me/15551234567"));
});

test("an invitation to go off-platform is caught", () => {
  assert.ok(flagged("Text me if interested"));
  assert.ok(flagged("DM me for details"));
});

test("an ordinary listing is not caught", () => {
  assert.ok(
    !flagged(
      "Saxon Math 7/6, second edition, good condition. Cover is scuffed but the binding is sound. Happy to meet somewhere central.",
    ),
  );
  assert.ok(!flagged("Latina Christiana I with the teacher manual, barely used."));
});

test("a price or an edition number is not mistaken for a telephone number", () => {
  assert.ok(!flagged("Asking $25 for the set, 3rd edition, published 2019."));
  assert.ok(!flagged("Grades 4-6, ISBN not to hand."));
});
