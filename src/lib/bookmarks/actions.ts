"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { currentAccountId } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";

/** Where each form returns to. A `next` that is not a path is an open door. */
function safeNext(formData: FormData): string {
  const next = String(formData.get("next") ?? "/portal/bookmarks");
  return next.startsWith("/") ? next : "/portal/bookmarks";
}

function flag(next: string, flag: string): string {
  return `${next}${next.includes("?") ? "&" : "?"}${flag}`;
}

const ID = z.string().uuid();

/**
 * Bookmarks are the durable layer of search (spec: federated resource
 * discovery) — the one thing a search leaves behind, chosen deliberately by
 * the parent. The account comes from the session, never from the form: RLS's
 * `with check` is the enforcement, and nothing here may even try to write
 * into someone else's collection.
 */
export async function saveBookmark(formData: FormData): Promise<void> {
  const next = safeNext(formData);
  const accountId = await currentAccountId();
  if (!accountId) redirect(`/login?next=${encodeURIComponent(next)}`);

  const url = String(formData.get("url") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const sourceLabel = String(formData.get("source_label") ?? "").trim().slice(0, 80) || null;
  const subject = String(formData.get("subject") ?? "general");

  if (!/^https:\/\//.test(url) || !title) {
    redirect(flag(next, "saved=invalid"));
  }

  const supabase = await createClient();
  // The migration's unique (account_id, url) makes saving deliberate and
  // idempotent: saving again refreshes the title and label, never the note.
  const { error } = await supabase.from("bookmarks").upsert(
    { account_id: accountId, url, title, source_label: sourceLabel, subject },
    { onConflict: "account_id,url" },
  );

  revalidatePath("/portal/bookmarks");
  redirect(flag(next, error ? "saved=error" : "saved=1"));
}

export async function setBookmarkNote(formData: FormData): Promise<void> {
  const next = safeNext(formData);
  const accountId = await currentAccountId();
  if (!accountId) redirect(`/login?next=${encodeURIComponent(next)}`);

  const id = ID.safeParse(formData.get("id"));
  if (!id.success) redirect(flag(next, "saved=invalid"));

  const note = String(formData.get("note") ?? "").trim().slice(0, 2000);

  const supabase = await createClient();
  // RLS confines the update to this account's rows; the id alone cannot reach
  // another account's bookmark.
  const { error } = await supabase
    .from("bookmarks")
    .update({ note: note || null })
    .eq("id", id.data);

  revalidatePath("/portal/bookmarks");
  redirect(flag(next, error ? "saved=error" : "saved=1"));
}

export async function deleteBookmark(formData: FormData): Promise<void> {
  const next = safeNext(formData);
  const accountId = await currentAccountId();
  if (!accountId) redirect(`/login?next=${encodeURIComponent(next)}`);

  const id = ID.safeParse(formData.get("id"));
  if (!id.success) redirect(flag(next, "saved=invalid"));

  const supabase = await createClient();
  // Same RLS scoping: deleting by id deletes a row only if it is the caller's.
  const { error } = await supabase.from("bookmarks").delete().eq("id", id.data);

  revalidatePath("/portal/bookmarks");
  redirect(flag(next, error ? "saved=error" : "saved=1"));
}
