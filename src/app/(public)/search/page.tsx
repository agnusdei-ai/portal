import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { Alert, Button, Card, Input } from "@/components/ui";
import { saveBookmark } from "@/lib/bookmarks/actions";
import { MAX_QUERY_LENGTH, runSearch, throttleKeys } from "@/lib/search/core";
import { configuredProviders } from "@/lib/search/providers";
import { getSearchThrottle } from "@/lib/search/throttle";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Search homeschooling resources",
  description:
    "One query across state networks, publishers, and curriculum vendors. Nothing about a search is stored.",
};

/** Subjects a parent files a saved resource under — the same set the bookmarks surface groups by. */
const SUBJECTS = ["general", "curriculum", "math", "reading", "science", "history", "arts"];

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
  searchParams: Promise<{ q?: string; saved?: string }>;
}) {
  const { q, saved } = await searchParams;
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

      {saved === "1" ? (
        <div className="mt-4" role="status">
          <Alert>
            Saved to your bookmarks —{" "}
            <Link href="/portal/bookmarks" className="underline">
              see your collection
            </Link>
            .
          </Alert>
        </div>
      ) : null}

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
              {outcome.hits.map((hit, i) => (
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
                    {/* Saving is the deliberate end of a search: the action
                        carries the hit's own url and title, the subject is the
                        parent's choice, and RLS binds the row to the saver. */}
                    <form action={saveBookmark} className="mt-3 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="url" value={hit.url} />
                      <input type="hidden" name="title" value={hit.title} />
                      <input type="hidden" name="source_label" value={`via ${hit.provider}`} />
                      <input
                        type="hidden"
                        name="next"
                        value={`/search?q=${encodeURIComponent(query)}`}
                      />
                      <label className="sr-only" htmlFor={`subject-${i}`}>
                        Subject
                      </label>
                      <select
                        id={`subject-${i}`}
                        name="subject"
                        className="rounded-md border border-rule bg-canvas px-2 py-1.5 text-sm text-ink"
                      >
                        {SUBJECTS.map((subject) => (
                          <option key={subject} value={subject}>
                            {subject}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md border border-rule px-3 py-1.5 text-sm text-ink hover:border-brand hover:text-brand"
                      >
                        Save
                      </button>
                    </form>
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
