"use client";

import { useActionState } from "react";

import { IDLE, startConsentCheckout } from "@/lib/setup/actions";
import { Alert, Button } from "@/components/ui";

export function ConsentForm() {
  const [state, formAction, pending] = useActionState(startConsentCheckout, IDLE);

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert>{state.error}</Alert> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Opening the processor…" : "Consent and pay"}
      </Button>
    </form>
  );
}
