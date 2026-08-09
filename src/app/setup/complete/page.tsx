import { ButtonLink, Card } from "@/components/ui";

/**
 * The processor redirects here on success. Deliberately does not create
 * anything: the seat and the consent record are written by the webhook, because
 * a success redirect is a claim made by a browser and the webhook is a claim
 * made by the processor with a signature attached.
 */
export default function SetupCompletePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Consent recorded</h1>
      <Card className="mt-6">
        <p className="text-sm leading-relaxed text-ink-soft">
          Your card issuer will show the charge, which is the confirmation that
          the consent came from a parent. Your seat appears in the portal within a
          few seconds of the processor confirming it.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          The next step is your household build, which is where your child&apos;s
          account is actually created and where everything about what they study
          stays.
        </p>
        <div className="mt-6">
          <ButtonLink href="/portal">Go to the portal</ButtonLink>
        </div>
      </Card>
    </div>
  );
}
