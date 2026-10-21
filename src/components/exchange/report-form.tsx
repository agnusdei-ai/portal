"use client";

import { useActionState } from "react";

import { EXCHANGE_IDLE, reportListing } from "@/lib/exchange/actions";
import { POSTING_REMINDER } from "@/lib/exchange/schema";
import { Alert, Button, Field, Textarea } from "@/components/ui";

// A reply is reported through its listing: the report is what lets a
// moderator open that listing's replies (0017).
export function ReportForm({ listingId, what }: { listingId: string; what: "listing" | "conversation" }) {
  const [state, formAction, pending] = useActionState(reportListing, EXCHANGE_IDLE);

  if (state.ok) return <p className="text-sm text-ink-soft">Thanks. A moderator will review it.</p>;

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-ink-faint underline">Report this {what}</summary>
      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="listing_id" value={listingId} />
        {state.error ? <Alert>{state.error}</Alert> : null}
        <Field label="What is wrong?" hint={POSTING_REMINDER}>
          <Textarea name="reason" rows={3} required minLength={3} maxLength={500} />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Sending…" : "Send report"}
        </Button>
      </form>
    </details>
  );
}
