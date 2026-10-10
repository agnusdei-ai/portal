import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/app/portal/messaging/page.tsx", "utf8");
const home = readFileSync("src/app/portal/page.tsx", "utf8");
const start = readFileSync("src/app/portal/start/page.tsx", "utf8");
const checklist = readFileSync("src/lib/onboarding/checklist.ts", "utf8");
const verification = readFileSync("src/lib/verification/states.ts", "utf8");

test("optional messenger choice is discoverable without entering onboarding or identity gates", () => {
  assert.match(home, /href="\/portal\/messaging"/);
  assert.match(start, /href="\/portal\/messaging"/);
  assert.match(page, /do not need Locuto or Signal/);
  assert.match(start, /not a required onboarding step/);
  assert.doesNotMatch(checklist, /id: "messaging"/);
  assert.match(verification, /state === "verified"/);
});

test("the only live download links are official Signal URLs", () => {
  assert.match(page, /https:\/\/apps\.apple\.com\/us\/app\/signal-private-messenger\/id874139669/);
  assert.match(page, /https:\/\/signal\.org\/download\//);
  assert.doesNotMatch(page, /https:\/\/apps\.apple\.com[^"\n]*locuto/i);
  assert.match(page, /official App Store link will be added/);
});

test("the page does not pretend to offer app-account verification or encrypted Portal replies", () => {
  assert.match(page, /messaging-account confirmation has not launched/i);
  assert.match(page, /not end-to-end encrypted/i);
  assert.match(page, /cannot\s+replace identity verification/);
  assert.doesNotMatch(page, /<form/);
  assert.doesNotMatch(page, /<button/);
});

test("neither Locuto nor Signal enrollment is part of the member identity rule", () => {
  assert.doesNotMatch(verification, /locuto|signal/i);
  assert.match(page, /separate from your Portal account/);
});
