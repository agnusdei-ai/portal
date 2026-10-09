import { NextResponse, type NextRequest } from "next/server";

import { runSearch, throttleKeys } from "@/lib/search/core";
import { configuredProviders } from "@/lib/search/providers";
import { getSearchThrottle } from "@/lib/search/throttle";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const keys = throttleKeys(
    request.headers.get("x-forwarded-for") ?? undefined,
    user?.id ?? null,
  );
  if (keys.length === 0) {
    // The throttle is what keeps this route from becoming a free proxy for
    // bulk harvesting. A caller nothing identifies cannot be throttled, so it
    // is not served; behind any real proxy the header is always present.
    return NextResponse.json({ error: "unidentifiable_caller" }, { status: 400 });
  }

  const outcome = await runSearch({
    query: request.nextUrl.searchParams.get("q") ?? "",
    providers: await configuredProviders(),
    throttle: getSearchThrottle(),
    keys,
  });

  if (outcome.kind === "rate_limited") {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "retry-after": String(outcome.retryAfterSeconds) } },
    );
  }
  if (outcome.kind === "invalid_query") {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }
  return NextResponse.json({ hits: outcome.hits, failedProviders: outcome.failedProviders });
}
