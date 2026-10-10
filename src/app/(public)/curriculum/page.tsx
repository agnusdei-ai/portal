import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { SUBJECTS } from "@/lib/catalogue";
import { ButtonLink, Card, SupportBadge } from "@/components/ui";

export const metadata: Metadata = {
  title: "Curriculum directory",
  description:
    "Browse homeschool curriculum by subject and teaching philosophy, and see how deeply Bede supports each one.",
};

export default async function CurriculumPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { subject } = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("curricula").select("*").order("publisher").order("title");
  if (subject) q = q.eq("subject", subject);
  const { data } = await q;
  const curricula = data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      <h1 className="text-4xl font-semibold">Explore homeschool curriculum</h1>
      <p className="mt-3 max-w-xl text-ink-soft">
        Browse by subject and see how much support Bede offers for the
        books you already use. Looking around is free.
      </p>

      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Filter by subject">
        <FilterChip href="/curriculum" active={!subject} label="All" />
        {SUBJECTS.map((s) => (
          <FilterChip
            key={s}
            href={`/curriculum?subject=${encodeURIComponent(s)}`}
            active={subject === s}
            label={s}
          />
        ))}
      </nav>

      {curricula.length === 0 ? (
        <Card className="mt-8 text-sm text-ink-soft">
          No curriculum listed{subject ? ` under ${subject}` : ""} yet.
          Try another subject or check back later.
        </Card>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {curricula.map((c) => (
            <li key={c.id}>
              <Card className="h-full">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{c.title}</h2>
                    <p className="text-sm text-ink-faint">{c.publisher}</p>
                  </div>
                  <SupportBadge level={c.bede_support} />
                </div>
                <p className="mt-3 text-sm text-ink-soft">{c.description}</p>
                <p className="mt-3 text-xs text-ink-faint">
                  {c.subject}
                  {c.grade_min && c.grade_max ? ` · Grades ${c.grade_min}–${c.grade_max}` : ""}
                  {c.philosophy ? ` · ${c.philosophy}` : ""}
                </p>
                <div className="mt-4">
                  <ButtonLink href={`/setup?curriculum=${c.slug}`}>
                    Explore Bede setup
                  </ButtonLink>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
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
