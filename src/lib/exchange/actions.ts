"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  EXCHANGE_IDLE,
  listingSchema,
  replySchema,
  type ExchangeActionState,
} from "@/lib/exchange/schema";

export { EXCHANGE_IDLE };

/**
 * The account of the signed-in user, or null.
 *
 * Posting and replying both require one, which is what makes the exchange
 * adult-to-adult in docs/portal.md §6's sense: an account exists only behind the
 * §3 card transaction, so every participant is an adult who completed one. That
 * is a stronger adult check than a classifieds board normally has, and it comes
 * free from the consent mechanism.
 */
async function currentAccountId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  return data?.id ?? null;
}

export async function createListing(
  _prev: ExchangeActionState,
  formData: FormData,
): Promise<ExchangeActionState> {
  const parsed = listingSchema.safeParse({
    category: formData.get("category"),
    title: formData.get("title"),
    body: formData.get("body"),
    state_code: formData.get("state_code"),
    region: formData.get("region"),
    attested: formData.get("attested"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const accountId = await currentAccountId();
  if (!accountId) {
    return {
      ok: false,
      error: "Posting needs a household licence. Browsing is free and always will be.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("listings").insert({
    category: parsed.data.category,
    title: parsed.data.title,
    body: parsed.data.body,
    state_code: parsed.data.state_code,
    region: parsed.data.region,
    posted_by_account: accountId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/exchange");
  redirect("/exchange?posted=1");
}

export async function replyToListing(
  _prev: ExchangeActionState,
  formData: FormData,
): Promise<ExchangeActionState> {
  const parsed = replySchema.safeParse({
    listing_id: formData.get("listing_id"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const accountId = await currentAccountId();
  if (!accountId) {
    return { ok: false, error: "Replying needs a household licence." };
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

export async function withdrawListing(formData: FormData): Promise<void> {
  const id = String(formData.get("listing_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("listings").update({ state: "withdrawn" }).eq("id", id);
  revalidatePath("/exchange");
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
