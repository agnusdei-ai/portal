"use client";

import { useActionState } from "react";

import { saveFamily } from "@/lib/onboarding/actions";
import { IDLE } from "@/lib/onboarding/schema";
import { Alert, Button, Field, Input } from "@/components/ui";
import type { Family } from "@/lib/types";

function defaultSchoolYear() {
  const now = new Date();
  // A school year is named for the calendar year it starts in, and setup for the
  // coming year usually happens in the spring — so before July, default back one.
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

export function FamilyForm({ family }: { family: Family | null }) {
  const [state, formAction, pending] = useActionState(saveFamily, IDLE);

  return (
    <form action={formAction} className="max-w-md space-y-5">
      {state.error ? <Alert>{state.error}</Alert> : null}

      <Field
        label="School name"
        hint="Most families use their surname — this appears on records."
        errors={state.fieldErrors?.name}
      >
        <Input
          name="name"
          required
          defaultValue={family?.name ?? ""}
          placeholder="The Gonzalez Academy"
        />
      </Field>

      <Field
        label="State"
        hint="Recordkeeping rules are set state by state; this decides which reports Bede generates."
        errors={state.fieldErrors?.state_code}
      >
        <Input
          name="state_code"
          required
          maxLength={2}
          className="uppercase"
          defaultValue={family?.state_code ?? ""}
          placeholder="TX"
        />
      </Field>

      <Field label="School year" errors={state.fieldErrors?.school_year}>
        <Input
          name="school_year"
          required
          defaultValue={family?.school_year ?? defaultSchoolYear()}
          placeholder="2026-2027"
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
