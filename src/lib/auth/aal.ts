/**
 * The two-factor assurance gate (spec art_ztdch8TP, "Sign-in and multi-factor
 * authentication" and "Exchange enforcement").
 *
 * A fresh sign-in is AAL1. Once a TOTP factor is enrolled, participation waits
 * for the challenge that promotes the session to AAL2. Listing and enrolling
 * factors stay reachable at AAL1 — the challenge is how a session gets to
 * AAL2, so gating the enrollment surface would deadlock it.
 *
 * Import-free on purpose: the decision is one source of truth read by the
 * middleware, the callback route and the participation gate, and the tests
 * execute this module directly.
 */

export type AalLevel = "aal1" | "aal2";

export type MfaState = {
  /** A verified TOTP factor exists for this user. */
  enrolled: boolean;
  /** The session's current assurance level, or null without a session. */
  currentLevel: AalLevel | null;
};

/** The slice of the Supabase client these decisions read. */
type MfaClient = {
  auth: {
    mfa: {
      getAuthenticatorAssuranceLevel(): Promise<{
        data: { currentLevel: string | null } | null;
      }>;
      listFactors(): Promise<{
        data: { all: { factor_type: string; status: string }[] } | null;
      }>;
    };
  };
};

/** Entry pages whose whole purpose is a participation write. */
const WRITE_ENTRY_PATHS = ["/exchange/new", "/exchange/waiver"];

export function isExchangeWriteEntry(pathname: string): boolean {
  return WRITE_ENTRY_PATHS.includes(pathname);
}

/**
 * AAL2 implies a verified factor (the level is only reachable by verifying
 * one), so enrollment is asked of the vendor only for sessions below it.
 */
export async function mfaSessionState(supabase: MfaClient): Promise<MfaState> {
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") {
    return { enrolled: true, currentLevel: "aal2" };
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const enrolled = (factors?.all ?? []).some(
    (f) => f.factor_type === "totp" && f.status === "verified",
  );
  return { enrolled, currentLevel: (aal?.currentLevel as AalLevel | null) ?? null };
}

/** A level short of aal2 — or unknown — blocks participation. */
export function challengeRequired(state: MfaState): boolean {
  return state.enrolled && state.currentLevel !== "aal2";
}
