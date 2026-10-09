import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { challengeRequired, mfaSessionState } from "@/lib/auth/aal";
import { callbackTarget, safeNext } from "@/lib/auth/callback";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // A fresh sign-in with an enrolled factor is AAL1; the challenge
      // promotes it to AAL2 and returns to `next` (spec, "Challenge at
      // sign-in"). Magic link and OAuth both land here.
      const target = callbackTarget({
        sessionEstablished: true,
        challengeRequired: challengeRequired(await mfaSessionState(supabase)),
        next,
      });
      return NextResponse.redirect(`${origin}${target}`);
    }
  }

  return NextResponse.redirect(
    `${origin}${callbackTarget({ sessionEstablished: false, challengeRequired: false, next })}`,
  );
}
