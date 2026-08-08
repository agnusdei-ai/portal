"use client";

import { useActionState, useEffect, useRef } from "react";

import { addStudent } from "@/lib/onboarding/actions";
import { GRADE_LEVELS, IDLE } from "@/lib/onboarding/schema";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

export function StudentForm() {
  const [state, formAction, pending] = useActionState(addStudent, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Adding children is repetitive — clear the form and return focus so the next
  // one can be typed without reaching for the mouse.
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      firstFieldRef.current?.focus();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-[1fr_8rem_8rem]">
        <Field label="First name" errors={state.fieldErrors?.first_name}>
          <Input ref={firstFieldRef} name="first_name" required placeholder="Cecilia" />
        </Field>

        <Field label="Grade" errors={state.fieldErrors?.grade_level}>
          <Select name="grade_level" required defaultValue="">
            <option value="" disabled>
              Pick…
            </option>
            {GRADE_LEVELS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Birth year" hint="Optional" errors={state.fieldErrors?.birth_year}>
          <Input name="birth_year" inputMode="numeric" placeholder="2015" />
        </Field>
      </div>

      <Field
        label="Anything Bede should know"
        hint="Optional — reading level, accommodations, a subject they struggle with."
        errors={state.fieldErrors?.notes}
      >
        <Input name="notes" placeholder="Reads well above grade level; dislikes drill." />
      </Field>

      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Adding…" : "Add student"}
      </Button>
    </form>
  );
}
