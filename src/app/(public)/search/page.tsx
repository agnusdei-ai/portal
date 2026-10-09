import type { Metadata } from "next";
import { headers } from "next/headers";

import { Alert, Button, Card, Input } from "@/components/ui";
import { MAX_QUERY_LENGTH, runSearch, throttleKeys } from "@/lib/search/core";
import { configuredProviders } from "@/lib/search/providers";
import { getSearchThrottle } from "@/lib/search/throttle";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Search homeschooling resources",
  description:
    "One query across state networks, publishers, and curriculum vendors. Nothing about a search is stored.",
};

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No configured providers means nothing to fan out to — say so instead of
  // spending a throttle token on an empty gesture.
  const providers = await configuredProviders();
  const outcome =
    query && providers.length
      ? await runSearch({
          query,
          providers,
          throttle: getSearchThrottle(),
          keys: throttleKeys(
            (await headers()).get("x-forwarded-for") ?? undefined,
            user?.id ?? null,
          ),
        })
      : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="text-4xl font-semibold">Search</h1>
      <p className="mt-3 max-w-xl text-ink-soft">
        One query across the state networks, publishers, and catalogues worth
        reading. Results are relayed from the sources at request time and
        nothing about a search is kept — what you save is yours alone.
      </p>

      <form action="/search" method="get" className="mt-6 flex gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={query}
          maxLength={MAX_QUERY_LENGTH}
          placeholder="Try: algebra manipulatives"
          aria-label="Search query"
          className="flex-1"
        />
        <Button type="submit">Search</Button>
      </form>

      {query && providers.length === 0 ? (
        <Card className="mt-8 text-sm text-ink-soft">
          Search isn&apos;t wired up yet — no provider is configured. The{" "}
          catalogue and co-op directory work meanwhile.
        </Card>
      ) : null}

      {outcome?.kind === "rate_limited" ? (
        <div className="mt-8">
          <Alert>
            You are searching faster than the relay can carry. Wait a minute and
            try again — the pause is what keeps search honest for everyone.
          </Alert>
        </div>
      ) : null}

      {outcome?.kind === "hits" ? (
        <>
          {outcome.failedProviders.length > 0 ? (
            <div className="mt-8">
              <Alert>
                {outcome.failedProviders.join(", ")} did not answer — these
                results are from the sources that did.
              </Alert>
            </div>
          ) : null}

          {outcome.hits.length === 0 ? (
            <Card className="mt-8 text-sm text-ink-soft">
              Nothing came back for that. Fewer words, or different ones, often
              finds it.
            </Card>
          ) : (
            <ul className="mt-8 space-y-4">
              {outcome.hits.map((hit) => (
                <li key={hit.url}>
                  <Card>
                    <a
                      href={hit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-ink underline decoration-rule hover:decoration-ink"
                    >
                      {hit.title}
                    </a>
                    <p className="mt-1 text-xs text-ink-faint">
                      {hostnameOf(hit.url)} · via {hit.provider}
                    </p>
                    {hit.snippet ? (
                      <p className="mt-2 text-sm text-ink-soft">{hit.snippet}</p>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
