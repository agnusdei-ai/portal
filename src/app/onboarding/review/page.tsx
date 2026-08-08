import Link from "next/link";

import { guardStep } from "@/lib/onboarding/actions";
import { getOnboardingState } from "@/lib/onboarding/queries";
import { buildHandoffPayload } from "@/lib/bede/handoff";
import { FinishForm } from "@/components/onboarding/finish-form";
import { StepShell } from "@/components/onboarding/step-shell";
import { Card, SupportBadge } from "@/components/ui";

export default async function ReviewStep() {
  await guardStep("review");
  const { family, students, coop } = await getOnboardingState();
  if (!family) return null;

  // Built here purely to show the parent what will be sent. The action rebuilds
  // it server-side at submit time — this render is never the source of truth.
  const payload = buildHandoffPayload({ family, coop, students });
  const courseCount = payload.students.reduce((n, s) => n + s.courses.length, 0);
  const unsupported = payload.students
    .flatMap((s) => s.courses)
    .filter((c) => c.bede_support === "unsupported");

  return (
    <StepShell
      title="Review"
      intro="This is exactly what we hand to Bede. Check it over — you can change anything later."
    >
      <Card>
        <h2 className="font-medium">{family.name}</h2>
        <p className="text-sm text-ink-faint">
          {family.state_code} · {family.school_year} · {students.length}{" "}
          {students.length === 1 ? "student" : "students"} · {courseCount}{" "}
          {courseCount === 1 ? "course" : "courses"}
        </p>
        {coop ? (
          <p className="mt-2 text-sm text-ink-soft">
            Co-op: {coop.name}
            {coop.meeting_day ? ` (${coop.meeting_day})` : ""}
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-faint">
            No co-op —{" "}
            <Link href="/onboarding/coop" className="underline">
              add one
            </Link>
            .
          </p>
        )}
      </Card>

      {payload.students.map((s) => (
        <Card key={s.id}>
          <div className="flex items-baseline justify-between">
            <h3 className="font-medium">{s.first_name}</h3>
            <span className="text-xs text-ink-faint">Grade {s.grade_level}</span>
          </div>
          <ul className="mt-3 space-y-2">
            {s.courses.map((c, i) => (
              <li key={`${c.subject}-${i}`} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 text-ink-faint">{c.subject}</span>
                <span className="min-w-0 flex-1">
                  {c.title}
                  {c.publisher ? (
                    <span className="text-ink-faint"> · {c.publisher}</span>
                  ) : null}
                  {c.source === "coop" ? (
                    <span className="text-ink-faint"> · co-op pacing</span>
                  ) : null}
                </span>
                {c.bede_support ? (
                  <SupportBadge level={c.bede_support as "native" | "assisted" | "unsupported"} />
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {unsupported.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            {unsupported.length}{" "}
            {unsupported.length === 1 ? "course isn't" : "courses aren't"} something
            Bede can teach yet. They&apos;ll still appear on records and transcripts —
            Bede just won&apos;t plan lessons for them.
          </p>
        </Card>
      ) : null}

      <FinishForm />
    </StepShell>
  );
}
