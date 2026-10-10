import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/exchange/schema";
import { ButtonLink, Card } from "@/components/ui";
import type { Listing, ListingCategory } from "@/lib/types";

export const metadata: Metadata = {
  title: "Share and exchange homeschool materials",
  description:
    "Homeschool materials, co-op openings and classes, offered by households near you. Free to browse.",
};

export default async function ExchangePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; category?: string; posted?: string }>;
}) {
  const { state, category, posted } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select("*")
    .eq("state", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(60);

  if (state) query = query.eq("state_code", state.toUpperCase());
  if (isCategory(category)) query = query.eq("category", category);

  const { data } = await query;
  const listings = (data ?? []) as Listing[];

  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      <h1 className="text-4xl font-semibold">Share, swap, and find what you need</h1>
      <p className="mt-3 max-w-xl text-ink-soft">
        Browse books, supplies, classes, and co-op openings shared by other adults.
        Looking around is free. You and the other person arrange any handover.
      </p>

      {posted ? (
        <Card className="mt-6 border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-900">
            Your listing is live. It will close automatically after 30 days.
          </p>
        </Card>
      ) : null}

      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Filter by category">
        <Chip href="/exchange" label="All" active={!category} />
        {CATEGORIES.map((c) => (
          <Chip
            key={c.value}
            href={`/exchange?category=${c.value}`}
            label={c.label}
            active={category === c.value}
          />
        ))}
      </nav>

      {listings.length === 0 ? (
        <Card className="mt-8 text-sm text-ink-soft">
          Nothing here just yet. Try another category or check back later.
        </Card>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {listings.map((l) => (
            <li key={l.id}>
              <Card className="h-full">
                <Link href={`/exchange/${l.id}`} className="font-medium hover:underline">
                  {l.title}
                </Link>
                <p className="mt-1 text-xs text-ink-faint">
                  {CATEGORIES.find((c) => c.value === l.category)?.label} ·{" "}
                  {l.region}, {l.state_code}
                </p>
                <p className="mt-3 line-clamp-3 text-sm text-ink-soft">{l.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-10 flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="max-w-md">
          <p className="text-sm font-medium text-ink">A note about meeting up</p>
          <p className="mt-1 text-sm text-ink-soft">
            Arrange handovers in a public place. Leave children&apos;s names and private
            details out of listings. This adults-only exchange does not arrange
            childcare, private tutoring, or rides.
          </p>
        </div>
        <ButtonLink href="/exchange/new" variant="secondary">
          Post a listing
        </ButtonLink>
      </Card>
    </div>
  );
}

function isCategory(value: string | undefined): value is ListingCategory {
  return CATEGORIES.some((c) => c.value === value);
}

function Chip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <a
      href={href}
      className={`rounded-full px-3 py-1 text-sm ring-1 ring-inset transition-colors ${
        active
          ? "bg-brand text-white ring-brand"
          : "bg-white text-ink-soft ring-rule hover:bg-parchment-deep"
      }`}
    >
      {label}
    </a>
  );
}
