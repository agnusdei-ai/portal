import Link from "next/link";

import {
  adoptCoopCourse,
  finishCoop,
  guardStep,
  leaveCoop,
} from "@/lib/onboarding/actions";
import { getCoopCourses, getOnboardingState } from "@/lib/onboarding/queries";
import { CoopJoinForm } from "@/components/onboarding/coop-form";
import { StepShell } from "@/components/onboarding/step-shell";
import { Button, Card, Select, SupportBadge } from "@/components/ui";

export default async function CoopStep() {
  await guardStep("coop");
  const { students, coop } = await getOnboardingState();
  const coopCourses = coop ? await getCoopCourses(coop.id) : [];

  return (
    <StepShell
      title="Your co-op"
      intro="If you meet with a co-op, Bede follows their pacing for shared subjects and yours for everything else. Skip this if you don't."
    >
      {coop ? (
        <>
          <Card>
            <div className="flex items-start gap-4">
              <div>
                <h2 className="font-medium">{coop.name}</h2>
                <p className="text-sm text-ink-faint">
                  {[coop.region, coop.state_code].filter(Boolean).join(", ")}
                  {coop.meeting_day ? ` · Meets ${coop.meeting_day}` : ""}
                </p>
              </div>
              <form action={leaveCoop} className="ml-auto">
                <input type="hidden" name="coop_id" value={coop.id} />
                <Button variant="ghost" type="submit">
                  Leave
                </Button>
              </form>
            </div>
          </Card>

          {coopCourses.length > 0 ? (
            <Card>
              <h2 className="font-medium">Courses this co-op teaches together</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Add them to a child and Bede will follow the co-op&apos;s schedule
                rather than planning its own.
              </p>
              <ul className="mt-4 divide-y divide-rule">
                {coopCourses.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{c.title}</p>
                      <p className="text-xs text-ink-faint">
                        {c.subject} · {c.publisher}
                        {c.grade_level ? ` · Grade ${c.grade_level}` : ""}
                      </p>
                    </div>
                    <SupportBadge level={c.bede_support} />
                    <form action={adoptCoopCourse} className="ml-auto flex items-center gap-2">
                      <input type="hidden" name="curriculum_id" value={c.id} />
                      <input type="hidden" name="subject" value={c.subject} />
                      <input type="hidden" name="coop_id" value={coop.id} />
                      <Select name="student_id" required defaultValue="" className="w-40">
                        <option value="" disabled>
                          Add to…
                        </option>
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.first_name}
                          </option>
                        ))}
                      </Select>
                      <Button variant="secondary" type="submit">
                        Add
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <Card className="text-sm text-ink-soft">
              This co-op hasn&apos;t published a shared course list yet.
            </Card>
          )}
        </>
      ) : (
        <Card>
          <h2 className="font-medium">Have a join code?</h2>
          <div className="mt-4">
            <CoopJoinForm />
          </div>
          <p className="mt-4 text-xs text-ink-faint">
            Not sure if yours is listed? Browse the{" "}
            <Link href="/coops" className="underline">
              co-op directory
            </Link>
            .
          </p>
        </Card>
      )}

      <form action={finishCoop}>
        <Button type="submit">{coop ? "Continue" : "Skip for now"}</Button>
      </form>
    </StepShell>
  );
}
