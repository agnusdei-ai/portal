import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { readStripped } from "./helpers.mjs";

// Prices come from the signed contract through Stripe, never from code, and
// Locuto is free so it is never what a purchase is for (amendment 2 §3, §4.1).

const files = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
const SOURCES = files("src").map((f) => [f, readStripped(f)]);

// $1-style SQL placeholders are single digits; an amount is not.
test("no price amount is written into code", () => {
  const offences = SOURCES.filter(([, t]) => /SEAT_PRICE_MINOR|unit_amount:\s*\d|\$\d{2,}|\$\d+\.\d\d|\b\d+\s*(USD|dollars)\b/i.test(t)).map(([f]) => f);
  assert.deepEqual(offences, []);
});

test("nothing sells a Locuto license", () => {
  const offences = SOURCES.filter(([, t]) => /Locuto (household )?licen[cs]e/i.test(t)).map(([f]) => f);
  assert.deepEqual(offences, []);
});

// US English. Identifiers and import paths keep their names; signed documents
// (the hashed waiver) change only with a version bump, so they are excluded.
test("copy says license, not licence", () => {
  const offences = SOURCES.filter(([f]) => f !== "src/lib/consent/waiver.ts")
    .filter(([, t]) => /(?<![/\w-])licences?(?![\w-])/i.test(t))
    .map(([f]) => f);
  assert.deepEqual(offences, []);
});
