"use client";

import { useActionState } from "react";

import { EXCHANGE_IDLE, replyToListing } from "@/lib/exchange/actions";
import { Alert, Button, Field, Textarea } from "@/components/ui";

export function ReplyForm({ listingId }: { listingId: string }) {
  const [state, formAction, pending] = useActionState(replyToListing, EXCHANGE_IDLE);

  if (state.ok) {
    return (
      <p className="text-sm text-emerald-800">
        Sent. Their reply will appear in your portal.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="listing_id" value={listingId} />
      {state.error ? <Alert>{state.error}</Alert> : null}
      <Field label="Your message" errors={state.fieldErrors?.body}>
        <Textarea
          name="body"
          rows={4}
          required
          maxLength={2000}
          placeholder="Still available? I'm interested."
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reply"}
      </Button>
    </form>
  );
}
