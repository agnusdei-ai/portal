import type { VerificationDocumentType, VerificationState } from "@/lib/types";

/**
 * The vendor's decision vocabulary. It exists only in this file: the adapter
 * parses Socure's wire words into this union, and every reader downstream sees
 * the portal's own states (spec art_ztdch8TP, "Adult verification — state
 * mapping").
 */
export type SocureDecision = "accept" | "reject" | "refer" | "resubmit" | "review";

export function isSocureDecision(value: unknown): value is SocureDecision {
  return (
    value === "accept" ||
    value === "reject" ||
    value === "refer" ||
    value === "resubmit" ||
    value === "review"
  );
}

/**
 * The final mapping, applied when the DocV evaluation completes: accept→verified,
 * resubmit→retry_required, refer/review→manual_review, reject→declined.
 */
export function mapSocureDecision(decision: SocureDecision): VerificationState {
  switch (decision) {
    case "accept":
      return "verified";
    case "resubmit":
      return "retry_required";
    case "refer":
    case "review":
      return "manual_review";
    case "reject":
      return "declined";
  }
}

/**
 * The same decision at evaluation time — before any document has been captured.
 * An "accept" here is provisional: nothing is verified until the DocV
 * completion event arrives through the webhook, so it maps to "pending". The
 * other four are final at the identity screen, before capture would help.
 */
export function provisionalState(decision: SocureDecision): VerificationState {
  return decision === "accept" ? "pending" : mapSocureDecision(decision);
}

/**
 * US residents verify by driver's license or passport; international residents
 * must verify by passport — DocV covers international documents, and the intake
 * states the requirement before capture begins (spec art_ztdch8TP).
 */
export function permittedDocuments(
  residency: "us" | "international",
): VerificationDocumentType[] {
  return residency === "us" ? ["drivers_license", "passport"] : ["passport"];
}

/**
 * The verified-adult participation rule, pure and exported for the refusal
 * tests: an account may take part in the exchange only on a verified
 * attestation. Every other state — no attestation, pending, in review, in
 * need of a retry, declined — is refused; browsing needs nothing.
 */
export function verificationGate(
  state: VerificationState | null,
): "allowed" | "verification-required" {
  return state === "verified" ? "allowed" : "verification-required";
}
