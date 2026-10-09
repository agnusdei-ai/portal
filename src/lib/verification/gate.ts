import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { VerificationState } from "@/lib/types";

import { verificationGate } from "./states";

/**
 * The verified-adult gate. One decision, applied at the head of every surface
 * where another adult can be reached or a household credential is minted:
 * posting, replying, waiver acceptance, licence issuance — and vouching, when
 * a vouch action exists to gate. Unverified accounts may browse the exchange;
 * they cannot take part in it. The pure rule lives in states.ts so the
 * refusal tests can reach it without a server-only import.
 */

export { verificationGate };

/** The caller's attestation state, read through their own RLS session. */
export async function attestationState(
  accountId: string,
): Promise<VerificationState | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("verification_attestations")
    .select("state")
    .eq("account_id", accountId)
    .maybeSingle();
  return (data?.state as VerificationState | undefined) ?? null;
}

/**
 * Guards a participation action for an account id the caller has already
 * established. Unverified callers are sent to the verification page with the
 * `required` marker, so the page explains why they landed there.
 */
export async function requireVerifiedAccount(accountId: string): Promise<void> {
  if (verificationGate(await attestationState(accountId)) !== "allowed") {
    redirect("/portal/verify?required=1");
  }
}
