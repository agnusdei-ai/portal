"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createConsentCheckout } from "@/lib/billing/checkout";
import { getRecord, openRecord } from "@/lib/consent/record";
import { seatWordWarning } from "@/lib/consent/seat-label";
import { mintLicenceToken } from "@/lib/licence";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireVerifiedAccount } from "@/lib/verification/gate";

export interface ActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** A seat word that may identify the child, echoed so the parent can keep or change it. */
  seatWarning?: { word: string; message: string };
  /** Shown once and never retrievable again. */
  licenceToken?: string;
}

export const IDLE: ActionState = { ok: false };

/** Carries the open consent record across the redirect to the processor. */
const RECORD_COOKIE = "adx_consent_record";

const noticeSchema = z.object({
  // The schema enforces this shape; the regex is here only to say why.
  seat_word: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{2,24}$/, "Use one word of 2 to 24 letters, with no digits, spaces, or accents."),
  acknowledged: z.literal("on", {
    error: "The notice must be acknowledged to continue.",
  }),
});

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/setup");
  return user;
}

/**
 * compliance/parental-consent.md §2 step 4. The notice has been presented in
 * full; this records that it was acknowledged, and when.
 *
 * No account and no child account is created here. §2 step 6 puts account
 * creation after consent, and docs/portal.md §3 puts every family-keyed object
 * after the transaction.
 */
export async function acknowledgeNotice(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = noticeSchema.safeParse({
    seat_word: formData.get("seat_word"),
    acknowledged: formData.get("acknowledged"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const warning = seatWordWarning(parsed.data.seat_word);
  if (warning && formData.get("keep_word") !== "on") {
    return { ok: false, seatWarning: { word: parsed.data.seat_word, message: warning } };
  }

  const user = await requireUser();

  const recordId = await openRecord({
    ownerUserId: user.id,
    seatWord: parsed.data.seat_word,
    acknowledgedAt: new Date(),
  });

  const jar = await cookies();
  jar.set(RECORD_COOKIE, recordId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });

  redirect("/setup/consent");
}

/**
 * §2 step 5. Hands the parent to the processor, where the charge and its
 * notification to the cardholder constitute the consent.
 */
export async function startConsentCheckout(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const jar = await cookies();
  const recordId = jar.get(RECORD_COOKIE)?.value;

  if (!recordId) return { ok: false, error: "Start again from the notice." };

  const record = await getRecord(recordId);
  if (!record || record.owner_user_id !== user.id) {
    return { ok: false, error: "Start again from the notice." };
  }
  if (record.state !== "notice_acknowledged") {
    return { ok: false, error: "This consent step has already been completed." };
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (await headers()).get("origin") ??
    "http://localhost:3000";

  const session = await createConsentCheckout({
    consentRecordId: record.id,
    seatLabel: record.seat_label,
    customerEmail: user.email!,
    origin,
  });

  if (!session.url) return { ok: false, error: "The processor returned no checkout URL." };
  redirect(session.url);
}

/**
 * Mints the seat's licence token, in the parent's own authenticated session, and
 * returns it for a single render. Only the hash is kept, so this is the one
 * moment the token exists anywhere legible. Calling it again rotates the token
 * and invalidates the previous one.
 *
 * The token carries nothing about a child. docs/portal.md §5 puts the
 * child-to-curriculum join and the tutoring configuration on household hardware,
 * so the household build assembles its own configuration and the portal ships it
 * nothing.
 */
export async function issueLicence(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const seatId = String(formData.get("seat_id") ?? "");
  if (!seatId) return { ok: false, error: "No seat given." };

  const user = await requireUser();
  const supabase = await createClient();

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!account) return { ok: false, error: "That seat is not yours." };

  // A household credential is minted only to a verified adult.
  await requireVerifiedAccount(account.id);

  // Read through the caller's own session, so RLS is what proves they own the
  // seat rather than a check written here that could drift from the policy.
  const { data: seat } = await supabase
    .from("seats")
    .select("id, state")
    .eq("id", seatId)
    .maybeSingle();

  if (!seat) return { ok: false, error: "That seat is not yours." };
  if (seat.state !== "active") return { ok: false, error: "That seat is revoked." };

  const { token, sha256 } = mintLicenceToken();

  const { error } = await createServiceClient()
    .from("seats")
    .update({
      licence_token_sha256: `\\x${sha256.toString("hex")}`,
      licence_issued_at: new Date().toISOString(),
    })
    .eq("id", seatId);

  if (error) return { ok: false, error: error.message };

  void user;
  return { ok: true, licenceToken: token };
}
