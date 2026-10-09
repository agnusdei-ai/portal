import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { challengeRequired, mfaSessionState } from "./aal";

/**
 * The AAL2 gate for participation writes (spec art_ztdch8TP, "Exchange
 * enforcement"). When a factor is enrolled, post, reply, and waiver
 * acceptance run only on a session that has satisfied the second factor;
 * an AAL1 session is sent to the challenge page and returned to the
 * originating action afterward.
 *
 * Listing and enrolling factors themselves stay allowed at AAL1 — the
 * challenge page is how a session reaches AAL2, so gating the way there
 * would lock enrolled users out of the fix.
 */
export async function requireAal2(): Promise<void> {
  const supabase = await createClient();
  const state = await mfaSessionState(supabase);
  if (challengeRequired(state)) {
    redirect("/auth/mfa?next=/exchange");
  }
}
