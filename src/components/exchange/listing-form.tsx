"use client";

import { useActionState } from "react";

import { createListing, EXCHANGE_IDLE } from "@/lib/exchange/actions";
import { CATEGORIES } from "@/lib/exchange/schema";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

export function ListingForm() {
  const [state, formAction, pending] = useActionState(createListing, EXCHANGE_IDLE);

  return (
    <form action={formAction} className="max-w-lg space-y-5">
      {state.error ? <Alert>{state.error}</Alert> : null}

      <Field label="Category" errors={state.fieldErrors?.category}>
        <Select name="category" required defaultValue="">
          <option value="" disabled>
            Pick…
          </option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label} — {c.blurb}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Title" errors={state.fieldErrors?.title}>
        <Input name="title" required maxLength={120} placeholder="Saxon 7/6, good condition" />
      </Field>

      <Field
        label="Details"
        hint="No contact details: replies come through the exchange."
        errors={state.fieldErrors?.body}
      >
        <Textarea name="body" rows={6} required maxLength={4000} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
        <Field
          label="Region"
          hint="A metropolitan area or county, never an address."
          errors={state.fieldErrors?.region}
        >
          <Input name="region" required maxLength={80} placeholder="North Dallas" />
        </Field>
        <Field label="State" errors={state.fieldErrors?.state_code}>
          <Input name="state_code" required maxLength={2} className="uppercase" placeholder="TX" />
        </Field>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="attested" required className="mt-0.5 size-4 shrink-0" />
        <span className="text-ink-soft">
          This listing names no child, includes no member or attendee list, and
          gives no contact details or address.
        </span>
      </label>
      {state.fieldErrors?.attested ? (
        <p role="alert" className="text-xs text-brand">
          {state.fieldErrors.attested[0]}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Posting…" : "Post listing"}
      </Button>
    </form>
  );
}
