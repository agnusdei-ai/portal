import { challengeRequired, type MfaState } from "@/lib/auth/aal";
import { verificationGate } from "@/lib/verification/states";
import type { VerificationState } from "@/lib/types";

/**
 * The agent-interface gate (spec art_ztdch8TP, tutor persona row and the
 * acceptance row "the agent interface admits only verified, AAL2-authenticated
 * principals and returns trust and discovery data — never identity PII").
 *
 * It composes the exchange's own shipped decisions — `challengeRequired`
 * (feat/auth-mfa) and `verificationGate` (feat/socure-verification) — in the
 * same order the exchange actions apply them, so an agent principal is exactly
 * as trusted as an exchange participant. The difference is the response shape:
 * a household system reads JSON, so the refusals are typed codes rather than
 * the redirects the page surfaces use.
 */

export type AgentRefusal = "unauthenticated" | "assurance-required" | "verification-required";

export type AgentPrincipalInputs = {
  /** A session was presented and validated by the vendor. */
  authenticated: boolean;
  /** The caller's account row, when the session has one. */
  accountId: string | null;
  mfa: MfaState;
  /** The caller's own attestation state, read through their own RLS session. */
  verification: VerificationState | null;
};

export type AgentPrincipalDecision =
  | { ok: true; accountId: string }
  | { ok: false; refusal: AgentRefusal };

export function agentPrincipal(inputs: AgentPrincipalInputs): AgentPrincipalDecision {
  if (!inputs.authenticated) return { ok: false, refusal: "unauthenticated" };

  // Second factor when one is enrolled — the exchange's own semantics, which
  // stay prompted-not-forced until an MFA recovery path exists.
  if (challengeRequired(inputs.mfa)) return { ok: false, refusal: "assurance-required" };

  // A session without an account (an OAuth sign-in that never paid the consent
  // transaction) is unverified, not unauthenticated — the same refusal the
  // verify page explains.
  if (!inputs.accountId || verificationGate(inputs.verification) !== "allowed") {
    return { ok: false, refusal: "verification-required" };
  }

  return { ok: true, accountId: inputs.accountId };
}
