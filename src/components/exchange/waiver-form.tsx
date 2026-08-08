"use client";

import { useActionState } from "react";

import { acceptWaiver } from "@/lib/exchange/waiver-actions";
import { EXCHANGE_IDLE } from "@/lib/exchange/schema";
import { Alert, Button } from "@/components/ui";

export function WaiverForm() {
  const [state, formAction, pending] = useActionState(acceptWaiver, EXCHANGE_IDLE);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="accepted" required className="mt-0.5 size-4 shrink-0" />
        <span className="text-ink-soft">
          I have read this. I understand that exchange messages are not encrypted
          the way Locuto messages are, and that no child takes part in the
          exchange in any way.
        </span>
      </label>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="accepted_account" required className="mt-0.5 size-4 shrink-0" />
        <span className="text-ink-soft">
          I will log out when I have finished and will not let a child use this
          account. I accept responsibility for what is done through it.
        </span>
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Accept and continue"}
      </Button>
    </form>
  );
}
