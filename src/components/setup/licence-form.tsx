"use client";

import { useActionState } from "react";

import { IDLE, issueLicence } from "@/lib/setup/actions";
import { Alert, Button } from "@/components/ui";

export function LicenceForm({
  seatId,
  alreadyIssued,
}: {
  seatId: string;
  alreadyIssued: boolean;
}) {
  const [state, formAction, pending] = useActionState(issueLicence, IDLE);

  if (state.licenceToken) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-ink">
          Copy this now. It is shown once and cannot be retrieved again.
        </p>
        <code className="block overflow-x-auto rounded-md bg-parchment-deep px-3 py-2 font-mono text-xs break-all">
          {state.licenceToken}
        </code>
        <p className="text-xs text-ink-faint">
          Give it to your household build. It authorises the software to run and
          carries nothing about your child.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="seat_id" value={seatId} />
      {state.error ? <Alert>{state.error}</Alert> : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending
          ? "Issuing…"
          : alreadyIssued
            ? "Issue a new licence key"
            : "Issue licence key"}
      </Button>
      {alreadyIssued ? (
        <p className="text-xs text-ink-faint">
          Issuing a new key replaces the old one, which stops working.
        </p>
      ) : null}
    </form>
  );
}
