import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Whether an account may communicate. Not a server action: it takes an account
 * id, and "use server" would publish it as an endpoint anyone could call with
 * somebody else's.
 */
export async function waiverAccepted(accountId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("communication_waivers")
    .select("account_id")
    .eq("account_id", accountId)
    .is("withdrawn_at", null)
    .maybeSingle();
  return Boolean(data);
}
