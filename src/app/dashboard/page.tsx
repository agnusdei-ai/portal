import Link from "next/link";
import { redirect } from "next/navigation";

import { getOnboardingState } from "@/lib/onboarding/queries";
import { ButtonLink, Card } from "@/components/ui";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const { family, students, coop } = await getOnboardingState();

  // Anyone who hasn't finished setup belongs in the wizard, not here.
  if (!family) redirect("/onboarding/family");
  if (family.onboarding_step !== "complete") redirect("/onboarding");

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {welcome ? (
        <Card className="mb-8 border-emerald-200 bg-emerald-50">
          <h2 className="font-medium text-emerald-900">Bede is set up.</h2>
          <p className="mt-1 text-sm text-emerald-800">
            It has your curriculum and knows who it&apos;s teaching. Lesson planning
            and records land here as the year runs.
          </p>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-3xl font-semibold">{family.name}</h1>
        <span className="text-sm text-ink-faint">
          {family.school_year} · {family.state_code}
          {coop ? ` · ${coop.name}` : ""}
        </span>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {students.map((s) => (
          <Card key={s.id}>
            <div className="flex items-baseline justify-between">
              <h2 className="font-medium">{s.first_name}</h2>
              <span className="text-xs text-ink-faint">Grade {s.grade_level}</span>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-ink-soft">
              {s.bindings.map((b) => (
                <li key={b.id}>
                  <span className="text-ink-faint">{b.subject}</span>{" "}
                  {b.curriculum?.title ?? b.custom_title}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <h2 className="font-medium">Next</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Lesson planning, progress tracking, and state recordkeeping are the paid
          layers that build on this setup — not yet wired up in this scaffold.
        </p>
        <div className="mt-4 flex gap-3">
          <ButtonLink href="/onboarding/curriculum" variant="secondary">
            Edit curriculum
          </ButtonLink>
          <Link
            href="/curriculum"
            className="inline-flex items-center text-sm text-ink-soft underline"
          >
            Browse the catalog
          </Link>
        </div>
      </Card>
    </div>
  );
}
