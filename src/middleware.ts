import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { challengeRequired, isExchangeWriteEntry, mfaSessionState } from "@/lib/auth/aal";
import { createAdminClient } from "@/lib/abuse/admin";
import { sessionIdFromAccessToken, terminateAbusiveSession } from "@/lib/abuse/events";
import {
  checkBucket,
  EDGE_BUCKETS,
  type BucketName,
  type BucketState,
} from "@/lib/abuse/rate-limit";

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

// ===========================================================================
// Edge throttle (spec art_ztdch8TP, "Layer 2 — volume limits").
//
// The search and auth edges fail fast under load: a small burst is answered
// with 429, and a caller that keeps arriving after that has its session
// revoked and the event recorded (Layer 3). The buckets live in middleware
// memory on purpose — rate state survives nothing, and nothing about a
// caller is persisted here. The abuse record itself is account-scoped: the
// anonymous key below is read from the forwarded-for header and never
// leaves this map, and no request body is ever seen.
// ===========================================================================

const THROTTLED_EDGES: { prefix: string; bucket: BucketName }[] = [
  { prefix: "/api/search", bucket: "search" },
  { prefix: "/auth", bucket: "auth" },
  { prefix: "/login", bucket: "auth" },
];

const buckets = new Map<string, BucketState>();
/** A flood of unique keys must not grow the map without bound. */
const BUCKET_MAX_KEYS = 10_000;

function throttledEdge(pathname: string): { prefix: string; bucket: BucketName } | undefined {
  return THROTTLED_EDGES.find((edge) => pathname.startsWith(edge.prefix));
}

function bucketKey(
  bucket: BucketName,
  request: NextRequest,
  authUserId: string | null,
): string {
  if (authUserId) return `${bucket}:account:${authUserId}`;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${bucket}:anon:${forwarded || "unknown"}`;
}

function tooManyRequests(request: NextRequest): NextResponse {
  const response = new NextResponse(
    "Too many requests. Slow down, and try again in a moment.",
    { status: 429 },
  );
  // A terminated session's cookies are dead server-side; dropping them spares
  // the visitor a failed refresh on their next visit.
  for (const { name } of request.cookies.getAll()) {
    if (name.startsWith("sb-") && name.includes("-auth-token")) {
      response.cookies.delete(name);
    }
  }
  return response;
}

async function terminateAbusiveCaller(
  accessToken: string | null,
  authUserId: string | null,
  edge: string,
  strikes: number,
): Promise<void> {
  try {
    const admin = createAdminClient();
    let accountId: string | null = null;
    if (authUserId) {
      const { data } = await admin
        .from("accounts")
        .select("id")
        .eq("owner_user_id", authUserId)
        .maybeSingle();
      accountId = data?.id ?? null;
    }
    const result = await terminateAbusiveSession(admin, {
      sessionId: sessionIdFromAccessToken(accessToken),
      accountId,
      kind: "rate_limit",
      detail: { edge, strikes },
    });
    for (const message of result.errors) {
      console.error(`abuse termination incomplete: ${message}`);
    }
  } catch (error) {
    // The throttle decision stands even when the termination machinery is
    // unavailable — but the failure is never silent.
    console.error("abuse termination unavailable:", error);
  }
}

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

  // The throttle runs before every other decision on its edges: a caller
  // being throttled or terminated has no business in the auth flow or the
  // search route, whatever else the request would have triggered.
  const edge = throttledEdge(pathname);
  if (edge) {
    if (buckets.size >= BUCKET_MAX_KEYS) buckets.clear();
    const key = bucketKey(edge.bucket, request, user?.id ?? null);
    const { state, outcome } = checkBucket(
      buckets.get(key),
      Date.now(),
      EDGE_BUCKETS[edge.bucket],
    );
    buckets.set(key, state);

    if (outcome === "throttled") return tooManyRequests(request);
    if (outcome === "terminate") {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await terminateAbusiveCaller(
        session?.access_token ?? null,
        user?.id ?? null,
        edge.bucket,
        state.strikes,
      );
      return tooManyRequests(request);
    }
  }

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
