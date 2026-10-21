"use client";

import { useActionState } from "react";

import { acknowledgeNotice, IDLE } from "@/lib/setup/actions";
import { Alert, Button, Field, Input } from "@/components/ui";

export function NoticeForm() {
  const [state, formAction, pending] = useActionState(acknowledgeNotice, IDLE);
  const warning = state.seatWarning;

  return (
    <form action={formAction} className="max-w-md space-y-5">
      {state.error ? <Alert>{state.error}</Alert> : null}

      <Field
        label="Pick a word for this seat"
        hint="We add a short code, so the seat shows as something like lantern.k7q2. Only you see it. Do not use your child's name, initials, birthday, or school."
        errors={state.fieldErrors?.seat_word}
      >
        <Input
          key={warning?.word}
          name="seat_word"
          required
          maxLength={24}
          defaultValue={warning?.word}
          placeholder="lantern"
          autoComplete="off"
        />
      </Field>

      {warning ? (
        <div className="space-y-2">
          <Alert>{warning.message}</Alert>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="keep_word" className="mt-0.5 size-4 shrink-0" />
            <span>Keep this word anyway.</span>
          </label>
        </div>
      ) : null}

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="acknowledged"
          required
          className="mt-0.5 size-4 shrink-0"
        />
        <span>
          I have read the notice above. I am the parent or guardian of this child.
        </span>
      </label>
      {state.fieldErrors?.acknowledged ? (
        <p role="alert" className="text-xs text-brand">
          {state.fieldErrors.acknowledged[0]}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Continue to consent"}
      </Button>
    </form>
  );
}
