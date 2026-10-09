import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { challengeRequired, isExchangeWriteEntry, mfaSessionState } from "@/lib/auth/aal";

/** Everything under these prefixes requires a session. */
const PROTECTED_PREFIXES = ["/portal", "/setup/notice", "/setup/consent", "/exchange/new"];

/**
 * Idle sign-out.
 *
 * The exchange is adults-only and the schema makes that structural: there is no
 * participant class for a child, so no route reaches one. Credentials defeat
 * structure, though, and a child sitting down at a machine where a parent left
 * the portal open is the one way in that the design cannot close.
 *
 * The waiver puts the responsibility on the parent, which is the honest
 * allocation, and a responsibility that the product does nothing to support is
 * a disclaimer wearing a control's clothes. This is the control. It reduces the
 * window; it does not remove it, and the waiver says so.
 */
const IDLE_LIMIT_MS = 30 * 60 * 1000;
const ACTIVITY_COOKIE = "adx_seen";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refreshes the auth token and writes it back onto the response.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (needsAuth && !user) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (user) {
    const seen = Number(request.cookies.get(ACTIVITY_COOKIE)?.value ?? 0);

    if (seen && Date.now() - seen > IDLE_LIMIT_MS) {
      // Signing out happens in a route handler rather than here, because the
      // session has to be terminated on the server and not merely navigated
      // away from.
      const idle = request.nextUrl.clone();
      idle.pathname = "/auth/idle";
      idle.search = "";
      return NextResponse.redirect(idle);
    }

    // AAL2 for participation writes (spec art_ztdch8TP, "Exchange
    // enforcement"): once a factor is enrolled, the entry points of the
    // exchange's write actions require a session that has satisfied it.
    // The challenge page itself is exempt — it is how a session gets there.
    if (isExchangeWriteEntry(pathname)) {
      const state = await mfaSessionState(supabase);
      if (challengeRequired(state)) {
        const mfa = request.nextUrl.clone();
        mfa.pathname = "/auth/mfa";
        mfa.search = "";
        mfa.searchParams.set("next", pathname);
        return NextResponse.redirect(mfa);
      }
    }

    response.cookies.set(ACTIVITY_COOKIE, String(Date.now()), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  } else {
    response.cookies.delete(ACTIVITY_COOKIE);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets — the session still needs refreshing on
    // public pages so the header can show the right state.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
