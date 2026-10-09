"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireAal2 } from "@/lib/auth/enforcement";
import { currentAccountId } from "@/lib/account";
import {
  EXCHANGE_IDLE,
  listingSchema,
  replySchema,
  type ExchangeActionState,
} from "@/lib/exchange/schema";
import { CATEGORY_CLASSES } from "@/lib/exchange/axes";
import { waiverAccepted } from "@/lib/exchange/waiver";
import { requireVerifiedAccount } from "@/lib/verification/gate";
import { findCryptoSolicitation } from "@/lib/exchange/schema";
import { recordAbuseEvent } from "@/lib/abuse/events";
import { createServiceClient } from "@/lib/supabase/server";
import type { ParticipantClass } from "@/lib/types";

/** No more than this many listings from one account in twenty-four hours. */
const DAILY_LISTING_LIMIT = 10;

export { EXCHANGE_IDLE };

/**
 * A crypto refusal is recorded as well as returned (spec art_ztdch8TP,
 * "Layer 1"): the submission was blocked, and the event is how the block
 * becomes visible for safety review without storing the refused text. The
 * refused submission itself returns the same field errors it always would —
 * a failure to record must never turn into a different outcome for the
 * parent, so it is logged and left there.
 */
async function recordCryptoRefusal(accountId: string | null): Promise<void> {
  try {
    const errors = await recordAbuseEvent(createServiceClient(), {
      accountId,
      kind: "crypto_solicitation",
      action: "blocked",
    });
    for (const message of errors) console.error(`abuse event not recorded: ${message}`);
  } catch (error) {
    console.error("abuse event not recorded:", error);
  }
}

function solicitsCrypto(...values: (string | null | undefined)[]): boolean {
  return values.some((value) =>
    typeof value === "string" ? findCryptoSolicitation(value) !== null : false,
  );
}

export async function createListing(
  _prev: ExchangeActionState,
  formData: FormData,
): Promise<ExchangeActionState> {
  await requireAal2();

  const parsed = listingSchema.safeParse({
    category: formData.get("category"),
    title: formData.get("title"),
    body: formData.get("body"),
    state_code: formData.get("state_code"),
    region: formData.get("region"),
    posted_as: formData.get("posted_as"),
    attested: formData.get("attested"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    if (solicitsCrypto(String(formData.get("title") ?? ""), String(formData.get("body") ?? ""))) {
      await recordCryptoRefusal(await currentAccountId());
    }
    return {
      ok: false,
      fieldErrors,
    };
  }

  const accountId = await currentAccountId();
  if (!accountId) {
    return {
      ok: false,
      error: "Posting needs a household licence. Browsing is free and always will be.",
    };
  }

  await requireVerifiedAccount(accountId);

  if (!(await waiverAccepted(accountId))) {
    redirect("/exchange/waiver");
  }

  const postedAs = parsed.data.posted_as;
  const allowed = CATEGORY_CLASSES[parsed.data.category] ?? [];
  if (!allowed.includes(postedAs)) {
    return {
      ok: false,
      fieldErrors: { posted_as: ["That category cannot be posted in this capacity."] },
    };
  }

  const supabase = await createClient();

  // Rate limiting is most of what moderation without identity has available, so
  // it is checked rather than assumed. docs/portal.md §13.
  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("posted_by_account", accountId)
    .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if ((count ?? 0) >= DAILY_LISTING_LIMIT) {
    return {
      ok: false,
      error: `That is ${DAILY_LISTING_LIMIT} listings in a day, which is the limit. Try again tomorrow.`,
    };
  }

  const { error } = await supabase.from("listings").insert({
    category: parsed.data.category,
    title: parsed.data.title,
    body: parsed.data.body,
    state_code: parsed.data.state_code,
    region: parsed.data.region,
    posted_by_account: accountId,
    posted_as: postedAs as ParticipantClass,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/exchange");
  redirect("/exchange?posted=1");
}

export async function replyToListing(
  _prev: ExchangeActionState,
  formData: FormData,
): Promise<ExchangeActionState> {
  await requireAal2();

  const parsed = replySchema.safeParse({
    listing_id: formData.get("listing_id"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    if (solicitsCrypto(String(formData.get("body") ?? ""))) {
      await recordCryptoRefusal(await currentAccountId());
    }
    return {
      ok: false,
      fieldErrors,
    };
  }

  const accountId = await currentAccountId();
  if (!accountId) {
    return { ok: false, error: "Replying needs a household licence." };
  }

  await requireVerifiedAccount(accountId);

  if (!(await waiverAccepted(accountId))) {
    redirect("/exchange/waiver");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("listing_replies").insert({
    listing_id: parsed.data.listing_id,
    from_account: accountId,
    body: parsed.data.body,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/exchange/${parsed.data.listing_id}`);
  return { ok: true };
}

export async function reportListing(
  _prev: ExchangeActionState,
  formData: FormData,
): Promise<ExchangeActionState> {
  const listingId = String(formData.get("listing_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!listingId || reason.length < 3) {
    return { ok: false, error: "Say briefly what is wrong with it." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("listing_reports").insert({
    listing_id: listingId,
    reported_by: await currentAccountId(),
    reason,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
