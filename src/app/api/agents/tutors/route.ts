import { NextResponse, type NextRequest } from "next/server";

import { mfaSessionState } from "@/lib/auth/aal";
import { discoverTutors, parseLimit, type CoopRow } from "@/lib/agents/discovery";
import { agentPrincipal, type AgentRefusal } from "@/lib/agents/principal";
import { attestationState } from "@/lib/verification/gate";
import { createClient } from "@/lib/supabase/server";

/**
 * The tutor phase-B agent interface (spec art_ztdch8TP, tutor persona row;
 * option C ruled 2026-10-09): vetted tutor discovery and trust signals for
 * household-owned agent systems, acting as a verified adult's principal.
 *
 * Tutoring itself stays household-side — this surface carries no sessions, no
 * chat and no inference, and performs no messaging. Every read runs through
 * the caller's own RLS session (no service role, no new policies), and the
 * response is an allowlist of trust facts, never identity PII. The session
 * rules are the portal's own: the middleware refreshes the token and applies
 * the 30-minute idle sign-out to these routes exactly as to pages.
 */

const REFUSAL_STATUS: Record<AgentRefusal, 401 | 403> = {
  "unauthenticated": 401,
  "assurance-required": 403,
  "verification-required": 403,
};

export async function GET(request: NextRequest) {
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  if (limit === "invalid-limit") {
    return NextResponse.json({ error: "invalid-limit" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const mfa = user ? await mfaSessionState(supabase) : { enrolled: false, currentLevel: null };
  const account = user
    ? (await supabase.from("accounts").select("id").eq("owner_user_id", user.id).maybeSingle()).data
    : null;
  const verification = account ? await attestationState(account.id) : null;

  const decision = agentPrincipal({
    authenticated: user !== null,
    accountId: account?.id ?? null,
    mfa,
    verification,
  });

  if (!decision.ok) {
    return NextResponse.json(
      { error: decision.refusal },
      { status: REFUSAL_STATUS[decision.refusal] },
    );
  }

  // Past the gate the caller is a verified adult. Everything below is their
  // own RLS view of public facts, shaped for a principal that may act on it.
  const callerClasses = (
    await supabase
      .from("account_participants")
      .select("class")
      .eq("account_id", decision.accountId)
  ).data?.map((row) => row.class) ?? [];

  const { data: vouches } = await supabase
    .from("coop_affiliations")
    .select("account_id, class, vouched_at, coop_listing_id");
  const vouchRows = vouches ?? [];

  const coopIds = [...new Set(vouchRows.map((vouch) => vouch.coop_listing_id))];
  let coops: CoopRow[] = [];
  if (coopIds.length > 0) {
    const { data } = await supabase
      .from("coop_listings")
      .select("id, slug, name, state_code, region")
      .in("id", coopIds);
    coops = data ?? [];
  }

  const { data: axes } = await supabase.from("permitted_axes").select("a, b");

  return NextResponse.json(
    {
      principal: {
        account_id: decision.accountId,
        // The gate proved it; echoing it gives integrators a stable self-check.
        verification_state: "verified",
        classes: callerClasses,
      },
      tutors: discoverTutors(
        {
          callerAccountId: decision.accountId,
          callerClasses,
          vouches: vouchRows,
          coops,
          axes: axes ?? [],
        },
        limit,
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
