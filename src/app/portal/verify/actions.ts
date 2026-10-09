"use server";

import { redirect } from "next/navigation";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { intakeSchema, toIdentityIntake } from "@/lib/verification/intake";
import { SocureError, startEvaluation } from "@/lib/verification/socure";
import type { VerificationState } from "@/lib/types";

export interface VerificationActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** The provisional outcome of the evaluation call. */
  outcome?: VerificationState;
  reasonCodes?: string[];
  /**
   * The DocV handoff token. Transient by design: it lives in this response and
   * in the browser's memory for one capture session, and is never persisted.
   */
  docvTransactionToken?: string;
}

export const VERIFICATION_IDLE: VerificationActionState = { ok: false };

/**
 * The identity leg of adult verification, step 1 of 2: relay the intake to
 * Socure ID+ and anchor a pending attestation for the DocV completion event.
 *
 * The intake is validated, relayed, and dropped — it is never inserted into a
 * table and never logged. What persists is the attestation row the webhook
 * later completes: an evaluation reference, a state, and reason codes
 * (0003_verification.sql). The attestation has no client-write policy by
 * design, so the anchor is written under the service role, having established
 * the caller's own account first.
 */
export async function startVerification(
  _prev: VerificationActionState,
  formData: FormData,
): Promise<VerificationActionState> {
  const parsed = intakeSchema.safeParse({
    residency: formData.get("residency"),
    firstName: formData.get("firstName"),
    middleName: formData.get("middleName"),
    lastName: formData.get("lastName"),
    dob: formData.get("dob"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    line1: formData.get("line1"),
    line2: formData.get("line2"),
    city: formData.get("city"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode"),
    country: formData.get("country"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portal/verify");

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!account) redirect("/setup");

  let start;
  try {
    start = await startEvaluation(toIdentityIntake(parsed.data));
  } catch (err) {
    if (err instanceof SocureError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  // Upsert on the account: one attestation per account, tracking its latest
  // evaluation. Re-running the intake after a retry replaces the reference.
  const { error } = await createServiceClient()
    .from("verification_attestations")
    .upsert(
      {
        account_id: account.id,
        method: "socure_id_plus_docv",
        vendor_evaluation_id: start.vendorEvaluationId,
        state: start.state,
        reason_codes: start.reasonCodes,
        document_type: null,
        docv_reference_id: null,
        verified_at: null,
      },
      { onConflict: "account_id" },
    );

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    outcome: start.state,
    reasonCodes: start.reasonCodes,
    docvTransactionToken: start.docvTransactionToken ?? undefined,
  };
}
