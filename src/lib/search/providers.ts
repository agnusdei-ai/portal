import { createClient } from "@/lib/supabase/server";

import { createGoogleProvider } from "./providers/google";
import type { SearchProvider } from "./types";

/** A lens query cannot grow without bound; the cap keeps requests within the provider's limits. */
const MAX_LENS_DOMAINS = 30;

/**
 * The provider list is configuration, not architecture (spec: federated
 * resource discovery). Wave one ships Google Programmable Search plus the
 * homeschooling lens over the same engine, restricted to the hosts the public
 * catalogue already curates. A second vendor plugs in behind SearchProvider
 * when the operator supplies keys; until then no keys means no providers, and
 * the search page says so honestly rather than pretending to search.
 */
export async function configuredProviders(): Promise<SearchProvider[]> {
  const { GOOGLE_SEARCH_API_KEY: apiKey, GOOGLE_SEARCH_CX: cx } = process.env;
  if (!apiKey || !cx) return [];

  const supabase = await createClient();
  const { data } = await supabase.from("resource_links").select("url");

  const domains = [
    ...new Set(
      (data ?? []).flatMap((r) => {
        try {
          return [new URL(r.url).hostname];
        } catch {
          return [];
        }
      }),
    ),
  ].slice(0, MAX_LENS_DOMAINS);

  return [
    createGoogleProvider("web", { apiKey, cx }),
    ...(domains.length
      ? [createGoogleProvider("homeschool", { apiKey, cx, lensDomains: domains })]
      : []),
  ];
}
