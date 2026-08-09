"use client";

import { useActionState } from "react";

import { acknowledgeNotice, IDLE } from "@/lib/setup/actions";
import { Alert, Button, Field, Input } from "@/components/ui";

export function NoticeForm() {
  const [state, formAction, pending] = useActionState(acknowledgeNotice, IDLE);

  return (
    <form action={formAction} className="max-w-md space-y-5">
      {state.error ? <Alert>{state.error}</Alert> : null}

      <Field
        label="What should the child's account be called?"
        hint="This name appears on the purchase screen, so that the consent is tied to the account it authorises."
        errors={state.fieldErrors?.child_account_name}
      >
        <Input name="child_account_name" required maxLength={60} placeholder="Cecilia" />
      </Field>

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
