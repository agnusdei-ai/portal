import "server-only";

import { createClient } from "@/lib/supabase/server";
import { waiverIsCurrent } from "@/lib/exchange/waiver-state";
import { WAIVER } from "@/lib/consent/waiver";

/**
 * Whether an account may communicate. Not a server action: it takes an account
 * id, and "use server" would publish it as an endpoint anyone could call with
 * somebody else's.
 *
 * The check is version-aware (spec art_ztdch8TP, "Governing text"): an
 * account that accepted an older version of the waiver is asked again, once,
 * at its next participation. The version bump is the re-acceptance mechanism,
 * and an acceptance recorded under the current version ends the loop.
 */
export async function waiverAccepted(accountId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("communication_waivers")
    .select("version, withdrawn_at")
    .eq("account_id", accountId)
    .maybeSingle();
  return waiverIsCurrent(data, WAIVER.version);
}
