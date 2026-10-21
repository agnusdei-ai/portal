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

// DECISIONS.md: Bede always runs self-hosted; faith curricula are optional.
// Blueprint principle 4: copy matches shipped behavior.
const PUBLIC_COPY = SOURCES.filter(([f]) => f.startsWith("src/app/") || f.startsWith("src/components/") || f.startsWith("src/lib/docs/"));

test("the landing page says Bede runs on hardware in the home", () => {
  assert.match(readStripped("src/app/(public)/page.tsx"), /Bede runs on hardware in your home, not on our servers/);
});

test("no copy places Bede in our cloud or makes faith content required", () => {
  const hosted = /Bede\b[^.]{0,40}\b(in the cloud|on our servers|hosted by)/i;
  const required = /(faith|relig\w*|catech\w*|devotion\w*)[^.]{0,60}\b(required|mandatory|must)\b|\b(required|mandatory)\b[^.]{0,60}(faith|relig\w*|catech\w*)/i;
  const offences = PUBLIC_COPY.filter(([, t]) => hosted.test(t.replace(/not on our servers/g, "")) || required.test(t)).map(([f]) => f);
  assert.deepEqual(offences, []);
});

// Launch stores no support level (bede_support is NULL), so no copy may
// promise one per listing.
test("no copy promises a per-listing Bede support level", () => {
  const promise = /level of support|how (deeply|much support) Bede|where (Bede|help) is available/i;
  assert.deepEqual(PUBLIC_COPY.filter(([, t]) => promise.test(t)).map(([f]) => f), []);
});
