import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Terminates an idle session. Reached from the middleware, which can detect the
 * idleness but cannot end the session: navigating away leaves it valid, and a
 * session that is still valid is one a child can carry on using.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "?expired=1";

  const response = NextResponse.redirect(login);
  response.cookies.delete("adx_seen");
  return response;
}
