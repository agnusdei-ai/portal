"use client";

import { useActionState } from "react";

import { joinCoop } from "@/lib/onboarding/actions";
import { IDLE } from "@/lib/onboarding/schema";
import { Alert, Button, Field, Input } from "@/components/ui";

export function CoopJoinForm() {
  const [state, formAction, pending] = useActionState(joinCoop, IDLE);

  return (
    <form action={formAction} className="flex max-w-md items-end gap-3">
      <div className="flex-1">
        {state.error ? (
          <div className="mb-3">
            <Alert>{state.error}</Alert>
          </div>
        ) : null}
        <Field
          label="Join code"
          hint="Your co-op director hands these out."
          errors={state.fieldErrors?.join_code}
        >
          <Input
            name="join_code"
            required
            className="uppercase"
            placeholder="STJEROME26"
            autoComplete="off"
          />
        </Field>
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Joining…" : "Join"}
      </Button>
    </form>
  );
}
