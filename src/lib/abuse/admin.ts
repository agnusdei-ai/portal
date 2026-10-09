import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types";

/**
 * The service-role client for the abuse paths.
 *
 * `createServiceClient` in `@/lib/supabase/server` cannot serve here: it
 * imports `next/headers`, which has no meaning inside middleware, and the
 * throttle's termination path runs there. This one is plain supabase-js — no
 * cookie plumbing, because an admin call carries its authority in the key.
 *
 * Throws when the environment is not configured: a deployment that cannot
 * terminate abusive sessions must say so loudly rather than fail the throttle
 * open. Callers catch and log; the throttle decision itself stands either way.
 */
export function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin environment is not configured");
  }

  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
