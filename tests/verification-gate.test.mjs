import { test } from "node:test";
import assert from "node:assert/strict";

import { permittedDocuments, verificationGate } from "@/lib/verification/states";

/**
 * Gate refusals, spec art_ztdch8TP "Enforcement — where verified-adult is
 * required": an account without a verified attestation may browse the public
 * zone and see the exchange, but cannot participate. The wired gate module
 * (gate.ts) redirects on this same rule; the pure rule is what the actions
 * effectively enforce, so it is pinned here over fixtures.
 */

test("a verified attestation is allowed", () => {
  assert.equal(verificationGate("verified"), "allowed");
});

test("an unverified account — no attestation at all — is refused", () => {
  assert.equal(verificationGate(null), "verification-required");
});

test("every in-flight or negative state is refused", () => {
  for (const state of ["pending", "retry_required", "manual_review", "declined"]) {
    assert.equal(verificationGate(state), "verification-required");
  }
});

test("document eligibility still matches the gate's residency rules", () => {
  // The gate and the intake share one understanding of who may verify how.
  assert.deepEqual(permittedDocuments("us"), ["drivers_license", "passport"]);
  assert.deepEqual(permittedDocuments("international"), ["passport"]);
});
