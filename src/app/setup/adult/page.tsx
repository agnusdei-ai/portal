import { ButtonLink, Card } from "@/components/ui";

/**
 * compliance/parental-consent.md §2 step 2: an indication of thirteen or above
 * proceeds to ordinary self-run setup, and that document does not apply. Setup
 * for an adult happens in the client, not here, because the portal exists for
 * the licence and the consent ceremony rather than for account creation.
 */
export default function AdultSetupPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Setting up your own account</h1>
      <Card className="mt-6">
        <p className="text-sm leading-relaxed text-ink-soft">
          An account for someone thirteen or over is created in the app itself,
          on the device that will use it. There is no parental consent step, and
          nothing to do here first.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          A household licence is still what lets the software run, and you can
          buy one from the portal.
        </p>
        <div className="mt-6 flex gap-3">
          <ButtonLink href="/portal">Go to the portal</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Back to the site
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
