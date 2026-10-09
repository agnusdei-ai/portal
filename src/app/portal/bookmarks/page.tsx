import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { currentAccountId } from "@/lib/account";
import { createClient } from "@/lib/supabase/server";
import { deleteBookmark, setBookmarkNote } from "@/lib/bookmarks/actions";
import { Alert, Button, ButtonLink, Card, Textarea } from "@/components/ui";
import type { Bookmark } from "@/lib/types";

export const metadata: Metadata = {
  title: "Your bookmarks",
  description: "Resources you chose to keep. Visible to your account alone.",
};

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export default async function BookmarksPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;

  // The middleware already required a session for /portal; an account is what
  // makes the seat real, and without one there is nothing to show.
  const accountId = await currentAccountId();
  if (!accountId) redirect("/setup");

  const supabase = await createClient();
  // No account_id filter here on purpose: RLS is the ownership filter, and
  // duplicating it in the application would be a second check to drift.
  const { data: bookmarks } = await supabase
    .from("bookmarks")
    .select("*")
    .order("subject")
    .order("created_at", { ascending: false });

  const bySubject = new Map<string, Bookmark[]>();
  for (const bookmark of bookmarks ?? []) {
    const list = bySubject.get(bookmark.subject) ?? [];
    list.push(bookmark);
    bySubject.set(bookmark.subject, list);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-semibold">Your bookmarks</h1>
        <ButtonLink href="/search" variant="secondary">
          Find more to save
        </ButtonLink>
      </div>
      <p className="mt-2 max-w-xl text-sm text-ink-soft">
        Search finds it, this keeps it. Nothing here is visible to anyone but
        your account, and nothing is copied — these are pointers you chose.
      </p>

      {saved === "1" ? (
        <div className="mt-6" role="status">
          <Alert>Saved.</Alert>
        </div>
      ) : null}
      {saved === "invalid" || saved === "error" ? (
        <div className="mt-6">
          <Alert>
            {saved === "invalid"
              ? "That did not look like a page worth keeping. Try saving it again from search."
              : "Saving hit a snag. Try again in a moment."}
          </Alert>
        </div>
      ) : null}

      {(bySubject.size ?? 0) === 0 ? (
        <Card className="mt-8 text-sm text-ink-soft">
          Nothing kept yet. Search for a resource and choose{" "}
          <Link href="/search" className="underline">
            Save
          </Link>{" "}
          on the ones worth returning to.
        </Card>
      ) : (
        [...bySubject].map(([subject, list]) => (
          <section key={subject} className="mt-10">
            <h2 className="text-lg font-medium">{subject}</h2>
            <ul className="mt-4 space-y-3">
              {list.map((bookmark) => (
                <li key={bookmark.id}>
                  <Card>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <a
                        href={bookmark.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-ink underline decoration-rule hover:decoration-ink"
                      >
                        {bookmark.title}
                      </a>
                      <form action={deleteBookmark}>
                        <input type="hidden" name="id" value={bookmark.id} />
                        <input type="hidden" name="next" value="/portal/bookmarks" />
                        <button
                          type="submit"
                          className="text-xs text-ink-faint underline hover:text-brand"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                    <p className="mt-1 text-xs text-ink-faint">
                      {hostnameOf(bookmark.url)}
                      {bookmark.source_label ? ` · saved from ${bookmark.source_label}` : ""}
                      {" · "}
                      {new Date(bookmark.created_at).toLocaleDateString()}
                    </p>
                    <form action={setBookmarkNote} className="mt-3">
                      <input type="hidden" name="id" value={bookmark.id} />
                      <input type="hidden" name="next" value="/portal/bookmarks" />
                      <Textarea
                        name="note"
                        rows={2}
                        maxLength={2000}
                        placeholder="Your own words about it — why you kept it, which child it suits."
                        defaultValue={bookmark.note ?? ""}
                        aria-label={`Note on ${bookmark.title}`}
                      />
                      <div className="mt-2">
                        <Button variant="ghost" type="submit">
                          {bookmark.note ? "Update note" : "Add a note"}
                        </Button>
                      </div>
                    </form>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
