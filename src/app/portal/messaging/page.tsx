import Link from "next/link";

import { Card } from "@/components/ui";

/**
 * Optional messaging guidance only. No stored provider selection, identity
 * binding, challenge delivery, or pretense of an integrated Signal API.
 * Member identity verification remains with the approved identity provider.
 */
export default function MessagingPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm text-ink-faint">
        <Link href="/portal" className="underline">
          Your home
        </Link>
      </p>
      <h1 className="mt-3 text-3xl font-semibold">Choose how to keep in touch</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Private messaging is your choice. You do not need Locuto or Signal to
        create an Agnus Dei account, complete your identity check, or browse
        the community. Choose an app only when you want to use it.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-brand">
            Recommended
          </p>
          <h2 className="mt-2 text-xl font-semibold">Locuto</h2>
          <p className="mt-3 text-sm text-ink-soft">
            Agnus Dei&apos;s own private messenger. Locuto setup and recovery
            remain separate from your Portal account. You can choose it
            when a reviewed app release is available.
          </p>
          <p className="mt-4 text-sm text-ink-faint">
            The official App Store link will be added after the app is
            published and verified. No download link is available here yet.
          </p>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold">Signal</h2>
          <p className="mt-3 text-sm text-ink-soft">
            Prefer Signal? You can use it instead. Share your Signal
            contact link or QR code privately when both adults agree to
            connect. Your phone number does not need to appear in a listing.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <a
              href="https://apps.apple.com/us/app/signal-private-messenger/id874139669"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand underline"
            >
              Signal on the App Store
            </a>
            <a
              href="https://signal.org/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand underline"
            >
              Other devices
            </a>
          </div>
        </Card>
      </div>

      <Card className="mt-6 bg-parchment-deep/40">
        <h2 className="text-lg font-medium">What gets verified?</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Our identity provider checks that a Portal member is a real,
          eligible adult. A separate messaging check may later confirm
          that you can receive messages in your chosen app. It cannot
          replace identity verification or prove that a Signal or Locuto
          contact is the person they claim to be.
        </p>
        <p className="mt-3 text-sm text-ink-soft">
          Messaging-account confirmation has not launched. We will never
          ask you to share a Locuto recovery phrase, Signal PIN, private
          encryption key, or other account secret for verification.
        </p>
      </Card>

      <p className="mt-6 text-sm text-ink-faint">
        For now, Exchange replies still arrive inside the Portal and are
        not end-to-end encrypted. Agnus Dei can read them for safety and
        fraud review. Please keep sensitive details out of those replies.
      </p>
    </div>
  );
}
