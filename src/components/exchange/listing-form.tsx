"use client";

import { useActionState, useState } from "react";

import { createListing, EXCHANGE_IDLE } from "@/lib/exchange/actions";
import { CATEGORIES } from "@/lib/exchange/schema";
import { CATEGORY_CLASSES, CLASS_COPY } from "@/lib/exchange/axes";
import type { ParticipantClass } from "@/lib/types";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

export function ListingForm({ classes }: { classes: ParticipantClass[] }) {
  const [state, formAction, pending] = useActionState(createListing, EXCHANGE_IDLE);
  const [category, setCategory] = useState<string>("");

  // Only offer capacities this account actually holds and that the chosen
  // category permits. The database enforces both regardless.
  const available = classes.filter((c) =>
    category ? (CATEGORY_CLASSES[category] ?? []).includes(c) : true,
  );

  return (
    <form action={formAction} className="max-w-lg space-y-5">
      {state.error ? <Alert>{state.error}</Alert> : null}

      <Field label="Category" errors={state.fieldErrors?.category}>
        <Select
          name="category"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
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

      {category ? (
        <Field
          label="Posting as"
          hint="An educator or guide must be vouched for by a co-operative."
          errors={state.fieldErrors?.posted_as}
        >
          <Select name="posted_as" required defaultValue={available[0] ?? ""}>
            {available.length === 0 ? (
              <option value="" disabled>
                You cannot post in this category yet
              </option>
            ) : null}
            {available.map((c) => (
              <option key={c} value={c}>
                {CLASS_COPY[c].label} — {CLASS_COPY[c].blurb}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

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

      <Button type="submit" disabled={pending || available.length === 0}>
        {pending ? "Posting…" : "Post listing"}
      </Button>
    </form>
  );
}
