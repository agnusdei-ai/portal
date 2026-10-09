import { test } from "node:test";
import assert from "node:assert/strict";

import { agentPrincipal } from "@/lib/agents/principal";

/**
 * Agent-interface gate refusals (spec art_ztdch8TP, tutor persona row and the
 * acceptance row "the agent interface admits only verified, AAL2-authenticated
 * principals and returns trust and discovery data — never identity PII").
 *
 * The decision composes the exchange's own shipped gates — challengeRequired
 * (feat/auth-mfa) and verificationGate (feat/socure-verification) — so an
 * agent principal is exactly as trusted as an exchange participant; the
 * refusals are typed codes rather than the redirects the pages use.
 */

const AAL2 = { enrolled: true, currentLevel: "aal2" };
const AAL1 = { enrolled: true, currentLevel: "aal1" };

test("an unauthenticated caller is refused before anything else", () => {
  assert.deepEqual(
    agentPrincipal({
      authenticated: false,
      accountId: null,
      mfa: AAL2,
      verification: "verified",
    }),
    { ok: false, refusal: "unauthenticated" },
  );
});

test("an unverified fixture is refused as verification-required", () => {
  // No attestation at all, and every in-flight or negative state.
  for (const verification of [null, "pending", "retry_required", "manual_review", "declined"]) {
    assert.deepEqual(
      agentPrincipal({
        authenticated: true,
        accountId: "acc-1",
        mfa: AAL2,
        verification,
      }),
      { ok: false, refusal: "verification-required" },
      `state "${verification}" must not reach the discovery payload`,
    );
  }
});

test("an AAL1 fixture is refused as assurance-required", () => {
  assert.deepEqual(
    agentPrincipal({
      authenticated: true,
      accountId: "acc-1",
      mfa: AAL1,
      verification: "verified",
    }),
    { ok: false, refusal: "assurance-required" },
  );
  // An unknown level with an enrolled factor is equally short of AAL2.
  assert.deepEqual(
    agentPrincipal({
      authenticated: true,
      accountId: "acc-1",
      mfa: { enrolled: true, currentLevel: null },
      verification: "verified",
    }),
    { ok: false, refusal: "assurance-required" },
  );
});

test("a verified principal on an AAL2 session is admitted, with its account", () => {
  assert.deepEqual(
    agentPrincipal({
      authenticated: true,
      accountId: "acc-1",
      mfa: AAL2,
      verification: "verified",
    }),
    { ok: true, accountId: "acc-1" },
  );
});

test("assurance is asked before verification, matching the exchange's gate order", () => {
  // createListing applies requireAal2() before requireVerifiedAccount(); the
  // agent gate keeps that funnel so a mid-onboarding principal first lands on
  // the challenge it can actually fix.
  assert.deepEqual(
    agentPrincipal({
      authenticated: true,
      accountId: "acc-1",
      mfa: AAL1,
      verification: null,
    }),
    { ok: false, refusal: "assurance-required" },
  );
});

test("without an enrolled factor the first factor carries the principal", () => {
  // The exchange asks for AAL2 only when a factor is enrolled; enrollment is
  // prompted, not forced, until an MFA recovery path exists (spec open item).
  assert.deepEqual(
    agentPrincipal({
      authenticated: true,
      accountId: "acc-1",
      mfa: { enrolled: false, currentLevel: "aal1" },
      verification: "verified",
    }),
    { ok: true, accountId: "acc-1" },
  );
});

test("an authenticated user without an account is unverified, not unauthenticated", () => {
  // An OAuth sign-in that never paid the consent transaction has a session and
  // nothing else — the same refusal the verify page explains.
  assert.deepEqual(
    agentPrincipal({
      authenticated: true,
      accountId: null,
      mfa: { enrolled: false, currentLevel: "aal1" },
      verification: null,
    }),
    { ok: false, refusal: "verification-required" },
  );
});
