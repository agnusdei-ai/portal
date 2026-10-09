import { createClient } from "@/lib/supabase/server";

/**
 * The account of the signed-in user, or null. One helper for every surface
 * that needs the §3 rule — an account exists only behind the consent
 * transaction — read in one place rather than re-derived per module.
 */
export async function currentAccountId(): Promise<string | null> {
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
