"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { addBinding } from "@/lib/onboarding/actions";
import { IDLE, SUBJECTS } from "@/lib/onboarding/schema";
import { Alert, Button, Field, Input, Select, SupportBadge } from "@/components/ui";
import type { Curriculum, Student } from "@/lib/types";

export function BindingForm({
  students,
  curricula,
  defaultStudentId,
}: {
  students: Student[];
  curricula: Curriculum[];
  defaultStudentId?: string;
}) {
  const [state, formAction, pending] = useActionState(addBinding, IDLE);
  const [subject, setSubject] = useState<string>("");
  const [curriculumId, setCurriculumId] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);

  const matches = useMemo(
    () => (subject ? curricula.filter((c) => c.subject === subject) : []),
    [subject, curricula],
  );

  const selected = curricula.find((c) => c.id === curriculumId);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setSubject("");
      setCurriculumId("");
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Student" errors={state.fieldErrors?.student_id}>
          <Select name="student_id" required defaultValue={defaultStudentId ?? ""}>
            <option value="" disabled>
              Pick…
            </option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} (grade {s.grade_level})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Subject" errors={state.fieldErrors?.subject}>
          <Select
            name="subject"
            required
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setCurriculumId("");
            }}
          >
            <option value="" disabled>
              Pick…
            </option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {subject ? (
        <Field
          label="Which curriculum?"
          hint={
            matches.length
              ? "Pick from the catalog, or leave blank and type your own below."
              : "Nothing in the catalog for this subject yet — type what you're using below."
          }
        >
          <Select
            name="curriculum_id"
            value={curriculumId}
            onChange={(e) => setCurriculumId(e.target.value)}
          >
            <option value="">Not listed / something else</option>
            {matches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.publisher} — {c.title}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {selected ? (
        <div className="flex items-center gap-2 text-sm text-ink-soft">
          <SupportBadge level={selected.bede_support} />
          {selected.bede_support === "native"
            ? "Bede has this scope and sequence and will teach it lesson by lesson."
            : selected.bede_support === "assisted"
              ? "Bede knows this material but you'll set the pacing."
              : "Bede can't teach this one yet — it'll show on records but not in lessons."}
        </div>
      ) : subject ? (
        <Field
          label="What are you using?"
          hint="Anything at all — Bede will do its best with the title."
          errors={state.fieldErrors?.custom_title}
        >
          <Input name="custom_title" placeholder="Saxon Math 7/6" />
        </Field>
      ) : null}

      <Button type="submit" variant="secondary" disabled={pending || !subject}>
        {pending ? "Adding…" : "Add course"}
      </Button>
    </form>
  );
}
