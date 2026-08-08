import type { Metadata } from "next";

import { listCurricula } from "@/lib/onboarding/queries";
import { SUBJECTS } from "@/lib/onboarding/schema";
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
  const curricula = await listCurricula({ subject });

  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      <h1 className="text-4xl font-semibold">Curriculum</h1>
      <p className="mt-3 max-w-xl text-ink-soft">
        Free to browse, no account needed. The badge tells you how much of the
        teaching Bede can take on.
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
          Nothing listed yet{subject ? ` under ${subject}` : ""}. Seed the catalog with
          <code className="mx-1 rounded bg-parchment-deep px-1">supabase/seed.sql</code>
          to populate this page.
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
                  <ButtonLink href={`/login?mode=signup&curriculum=${c.slug}`}>
                    Use this with Bede
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
