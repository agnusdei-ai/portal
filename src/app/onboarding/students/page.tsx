import { finishStudents, guardStep, removeStudent } from "@/lib/onboarding/actions";
import { getOnboardingState } from "@/lib/onboarding/queries";
import { StudentForm } from "@/components/onboarding/student-form";
import { StepShell } from "@/components/onboarding/step-shell";
import { Button, Card } from "@/components/ui";

export default async function StudentsStep() {
  await guardStep("students");
  const { students } = await getOnboardingState();

  return (
    <StepShell
      title="Your students"
      intro="Bede plans and keeps records per child. Add everyone you're schooling this year."
    >
      {students.length > 0 ? (
        <ul className="space-y-2">
          {students.map((s) => (
            <li key={s.id}>
              <Card className="flex items-center gap-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{s.first_name}</p>
                  <p className="text-sm text-ink-faint">
                    Grade {s.grade_level}
                    {s.birth_year ? ` · b. ${s.birth_year}` : ""}
                  </p>
                </div>
                <form action={removeStudent} className="ml-auto">
                  <input type="hidden" name="student_id" value={s.id} />
                  <Button variant="ghost" type="submit">
                    Remove
                  </Button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      <Card>
        <StudentForm />
      </Card>

      <form action={finishStudents}>
        <Button type="submit" disabled={students.length === 0}>
          Continue
        </Button>
        {students.length === 0 ? (
          <p className="mt-2 text-xs text-ink-faint">Add at least one student to continue.</p>
        ) : null}
      </form>
    </StepShell>
  );
}
