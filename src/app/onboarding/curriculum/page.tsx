import { finishCurriculum, guardStep, removeBinding } from "@/lib/onboarding/actions";
import { getOnboardingState, listCurricula } from "@/lib/onboarding/queries";
import { BindingForm } from "@/components/onboarding/binding-form";
import { StepShell } from "@/components/onboarding/step-shell";
import { Button, Card, SupportBadge } from "@/components/ui";

export default async function CurriculumStep() {
  await guardStep("curriculum");
  const [{ students }, curricula] = await Promise.all([
    getOnboardingState(),
    listCurricula(),
  ]);

  const incomplete = students.filter((s) => s.bindings.length === 0);

  return (
    <StepShell
      title="Your curriculum"
      intro="The books already on your shelf. This is the step that makes Bede yours rather than generic — everything it teaches comes from here."
    >
      <div className="space-y-4">
        {students.map((s) => (
          <Card key={s.id}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-medium">{s.first_name}</h2>
              <span className="text-xs text-ink-faint">Grade {s.grade_level}</span>
            </div>

            {s.bindings.length === 0 ? (
              <p className="mt-2 text-sm text-ink-faint">No courses yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-rule">
                {s.bindings.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {b.curriculum?.title ?? b.custom_title}
                      </p>
                      <p className="text-xs text-ink-faint">
                        {b.subject}
                        {b.curriculum ? ` · ${b.curriculum.publisher}` : ""}
                        {b.source === "coop" ? " · from your co-op" : ""}
                      </p>
                    </div>
                    {b.curriculum ? (
                      <SupportBadge level={b.curriculum.bede_support} />
                    ) : null}
                    <form action={removeBinding} className="ml-auto">
                      <input type="hidden" name="binding_id" value={b.id} />
                      <Button variant="ghost" type="submit">
                        Remove
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="mb-4 font-medium">Add a course</h2>
        <BindingForm
          students={students}
          curricula={curricula}
          defaultStudentId={incomplete[0]?.id}
        />
      </Card>

      <form action={finishCurriculum}>
        <Button type="submit" disabled={incomplete.length > 0}>
          Continue
        </Button>
        {incomplete.length > 0 ? (
          <p className="mt-2 text-xs text-ink-faint">
            Still needs at least one course:{" "}
            {incomplete.map((s) => s.first_name).join(", ")}.
          </p>
        ) : null}
      </form>
    </StepShell>
  );
}
