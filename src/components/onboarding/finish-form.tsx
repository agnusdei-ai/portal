"use client";

import { useActionState } from "react";

import { completeOnboarding } from "@/lib/onboarding/actions";
import { IDLE } from "@/lib/onboarding/schema";
import { Alert, Button } from "@/components/ui";

export function FinishForm() {
  const [state, formAction, pending] = useActionState(completeOnboarding, IDLE);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Setting up Bede…" : "Hand this to Bede"}
      </Button>
      <p className="text-xs text-ink-faint">
        Nothing here is locked in — you can change any of it later from the portal.
      </p>
    </form>
  );
}
