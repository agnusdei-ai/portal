import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getRecord } from "@/lib/consent/record";
import { consentStatement } from "@/lib/consent/notice";
import { SEAT_CURRENCY, SEAT_PRICE_MINOR } from "@/lib/billing/stripe";
import { ConsentForm } from "@/components/setup/consent-form";
import { Alert, Card } from "@/components/ui";

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const { cancelled } = await searchParams;
  const recordId = (await cookies()).get("adx_consent_record")?.value;
  if (!recordId) redirect("/setup/notice");

  const record = await getRecord(recordId);
  if (!record) redirect("/setup/notice");
  if (record.state === "granted") redirect("/portal");

  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: SEAT_CURRENCY.toUpperCase(),
  }).format(SEAT_PRICE_MINOR / 100);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Consent</h1>

      {cancelled ? (
        <div className="mt-6">
          <Alert>
            The purchase was cancelled, so no consent was recorded and no account
            was created. You can start it again below.
          </Alert>
        </div>
      ) : null}

      {record.state === "refused" ? (
        <div className="mt-6">
          <Alert>
            {record.refusal_reason ?? "That payment method could not be accepted."}{" "}
            The charge was refunded. Please use a card held by a parent or
            guardian, or contact us to arrange another method.
          </Alert>
        </div>
      ) : null}

      <Card className="mt-8">
        <p className="text-sm leading-relaxed text-ink">
          {consentStatement(record.child_account_name)}
        </p>
        <p className="mt-4 text-sm text-ink-soft">
          The licence is {price}, charged once. The charge is what verifies that a
          parent gave consent, because your card issuer notifies you of it, so it
          is a real charge rather than a hold.
        </p>
        <p className="mt-3 text-xs text-ink-faint">
          We never see your card details. The processor handles them, and we keep
          only its transaction reference.
        </p>
        <div className="mt-6">
          <ConsentForm />
        </div>
      </Card>

      <p className="mt-6 text-xs text-ink-faint">
        The account for {record.child_account_name} is created after this step,
        never before it.
      </p>
    </div>
  );
}
