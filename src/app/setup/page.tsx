import Link from "next/link";

import { ButtonLink, Card } from "@/components/ui";

/**
 * compliance/parental-consent.md §2 steps 1 to 3. An indication of thirteen or
 * above proceeds to ordinary self-run setup and this flow does not apply. An
 * indication below thirteen halts and requires a parent to continue on their own
 * device, which is where the rest of this flow runs.
 */
export default function SetupPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Setting up an account</h1>
      <p className="mt-3 text-ink-soft">
        Who is this account for? The answer changes what happens next, because an
        account for a child under thirteen requires a parent or guardian to set it
        up.
      </p>

      <div className="mt-8 grid gap-4">
        <Card>
          <h2 className="font-medium">Someone aged thirteen or over</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Ordinary setup, run by the person themselves on their own device.
          </p>
          <div className="mt-4">
            <ButtonLink href="/setup/adult" variant="secondary">
              Continue
            </ButtonLink>
          </div>
        </Card>

        <Card>
          <h2 className="font-medium">A child under thirteen</h2>
          <p className="mt-2 text-sm text-ink-soft">
            A parent or guardian continues from here, on their own device. There
            is a notice to read first, and setting up the account is the last step
            rather than the first.
          </p>
          <div className="mt-4">
            <ButtonLink href="/setup/notice">I am the parent or guardian</ButtonLink>
          </div>
        </Card>
      </div>

      <p className="mt-8 text-xs text-ink-faint">
        Browsing{" "}
        <Link href="/curriculum" className="underline">
          curriculum
        </Link>
        ,{" "}
        <Link href="/coops" className="underline">
          co-ops
        </Link>{" "}
        and{" "}
        <Link href="/exchange" className="underline">
          the exchange
        </Link>{" "}
        never requires an account.
      </p>
    </div>
  );
}
