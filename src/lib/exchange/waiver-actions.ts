"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { WAIVER, WAIVER_SHA256 } from "@/lib/consent/waiver";
import { createClient } from "@/lib/supabase/server";
import { requireAal2 } from "@/lib/auth/enforcement";
import { requireVerifiedAccount } from "@/lib/verification/gate";
import type { ExchangeActionState } from "@/lib/exchange/schema";

/**
 * Accepting the communication waiver. Separate from the parental consent in the
 * `consent` schema: that one is evidenced by a card transaction under COPPA,
 * this one is an adult opting in to talk to other adults, and conflating them
 * would misrepresent both.
 *
 * Once accepted, a parent may communicate freely. There is no per-listing or
 * per-message gate after this point.
 */
export async function acceptWaiver(
  _prev: ExchangeActionState,
  formData: FormData,
): Promise<ExchangeActionState> {
  await requireAal2();

  if (formData.get("accepted") !== "on") {
    return { ok: false, error: "Please confirm you have read it." };
  }

  // Acknowledged separately from the rest, because a term allocating
  // responsibility should be agreed to conspicuously rather than swept up in a
  // single "I agree" covering seven headings.
  if (formData.get("accepted_account") !== "on") {
    return {
      ok: false,
      error:
        "Please confirm the second point too: keeping this account to adults is the part we cannot do for you.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/exchange/waiver");

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!account) redirect("/setup");

  await requireVerifiedAccount(account.id);

  const { error } = await supabase.from("communication_waivers").upsert(
    {
      account_id: account.id,
      version: WAIVER.version,
      sha256: `\\x${WAIVER_SHA256}`,
      accepted_at: new Date().toISOString(),
      withdrawn_at: null,
    },
    { onConflict: "account_id" },
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/exchange", "layout");
  redirect("/exchange/new");
}

/**
 * Withdrawal. Touches nothing else: not the household licence, not the Locuto
 * account, and not the parental consent given for a child.
 */
export async function withdrawWaiver(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (!account) return;

  await supabase
    .from("communication_waivers")
    .update({ withdrawn_at: new Date().toISOString() })
    .eq("account_id", account.id);

  // Their listings stop being shown. The rows stay, because a fraud
  // investigation needs the record of what was posted.
  await supabase
    .from("listings")
    .update({ state: "withdrawn" })
    .eq("posted_by_account", account.id)
    .eq("state", "active");

  revalidatePath("/exchange", "layout");
  redirect("/portal");
}
