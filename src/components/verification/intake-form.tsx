"use client";

import { useActionState, useState } from "react";

import {
  startVerification,
  VERIFICATION_IDLE,
} from "@/app/portal/verify/actions";
import { DocVHandoff } from "@/components/verification/docv-handoff";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

/** The evaluation accepted outright — no capture needed; the webhook confirms. */
function VerifiedCard() {
  return (
    <Alert>
      Your verification is complete. The exchange is open to you — see it on
      your household page in a moment.
    </Alert>
  );
}

export function IntakeForm({ reasonCodes }: { reasonCodes: string[] }) {
  const [state, formAction, pending] = useActionState(
    startVerification,
    VERIFICATION_IDLE,
  );
  const [residency, setResidency] = useState<"us" | "international">("us");
  const us = residency === "us";

  if (state.ok && state.outcome === "verified") {
    return <VerifiedCard />;
  }

  if (state.ok && state.docvTransactionToken) {
    return <DocVHandoff token={state.docvTransactionToken} />;
  }

  return (
    <form action={formAction} className="max-w-md space-y-5">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.outcome === "retry_required" && state.reasonCodes?.length ? (
        <Alert>
          The provider asked for a correction (reason{" "}
          {state.reasonCodes.join(", ")}). Submit again with a new document
          capture.
        </Alert>
      ) : null}
      {reasonCodes.length > 0 ? (
        <Alert>
          The provider asked for a correction (reason {reasonCodes.join(", ")}).
          Submit again with a new document capture.
        </Alert>
      ) : null}

      <Field
        label="Where do you live?"
        hint="International residents verify with a passport. US residents may use a driver's license or a passport."
      >
        <Select
          name="residency"
          value={residency}
          onChange={(e) => setResidency(e.target.value as "us" | "international")}
        >
          <option value="us">United States</option>
          <option value="international">Outside the United States</option>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="First name" errors={state.fieldErrors?.firstName}>
          <Input name="firstName" autoComplete="given-name" required maxLength={80} />
        </Field>
        <Field label="Middle name (optional)" errors={state.fieldErrors?.middleName}>
          <Input name="middleName" autoComplete="additional-name" maxLength={80} />
        </Field>
        <Field label="Last name" errors={state.fieldErrors?.lastName}>
          <Input name="lastName" autoComplete="family-name" required maxLength={80} />
        </Field>
        <Field
          label="Date of birth"
          hint="Used only for the check."
          errors={state.fieldErrors?.dob}
        >
          <Input name="dob" type="date" required />
        </Field>
      </div>

      <Field label="Email" errors={state.fieldErrors?.email}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </Field>

      <Field label="Phone (optional)" errors={state.fieldErrors?.phone}>
        <Input name="phone" type="tel" autoComplete="tel" maxLength={20} />
      </Field>

      <Field label="Street address" errors={state.fieldErrors?.line1}>
        <Input name="line1" autoComplete="address-line1" required maxLength={120} />
      </Field>
      <Field
        label="Apartment, suite, etc. (optional)"
        errors={state.fieldErrors?.line2}
      >
        <Input name="line2" autoComplete="address-line2" maxLength={120} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="City" errors={state.fieldErrors?.city}>
          <Input name="city" autoComplete="address-level2" required maxLength={80} />
        </Field>
        {us ? (
          <Field label="State" hint="Two letters." errors={state.fieldErrors?.state}>
            <Input name="state" autoComplete="address-level1" required maxLength={2} />
          </Field>
        ) : (
          <Field
            label="State or region (optional)"
            errors={state.fieldErrors?.state}
          >
            <Input name="state" maxLength={40} />
          </Field>
        )}
        {us ? (
          <Field
            label="ZIP code"
            hint="Five digits."
            errors={state.fieldErrors?.postalCode}
          >
            <Input
              name="postalCode"
              autoComplete="postal-code"
              required
              maxLength={5}
            />
          </Field>
        ) : (
          <Field
            label="Postal code (optional)"
            errors={state.fieldErrors?.postalCode}
          >
            <Input name="postalCode" autoComplete="postal-code" maxLength={16} />
          </Field>
        )}
        {us ? null : (
          <Field
            label="Country"
            hint="Two letters, e.g. GB."
            errors={state.fieldErrors?.country}
          >
            <Input name="country" required maxLength={2} />
          </Field>
        )}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Continue to document capture"}
      </Button>
    </form>
  );
}
