# Optional private messaging: Locuto or Signal

**Status:** approved product choice and proposed integration contract, not an operational account-confirmation service. The current Portal Exchange reply inbox still stores readable messages and keeps its existing waiver. See [the delivery checklist](implementation-checklist.md).

## The member's choice

**No messaging app is required to join Agnus Dei.** Admission requires a verified real human and the applicable adult eligibility checks, not a Locuto or Signal account. A member can browse and use non-messaging features without either app.

For private exchanges, two adults may choose:

- **Locuto (recommended).** Separate Agnus Dei messenger. Its identity creation and recovery process happens inside its own app and remains independent of Portal registration. Link to the official app listing only after its identity and release have been confirmed.
- **Signal.** Established external encrypted messenger. Use its published [iPhone/iPad App Store listing](https://apps.apple.com/us/app/signal-private-messenger/id874139669) or [official downloads](https://signal.org/download/). A member may share a username, QR code or shareable link directly with a consenting recipient. Signal usernames are changeable and must never become Portal identifiers.
- **Neither, for now.** Membership remains valid; there is no private messaging option for that exchange until the parties agree on an app. No covert downgrade to the current plaintext inbox.

Neither app is bundled into the Portal or installed automatically. No choice is collected or persisted merely by viewing the messaging-options page. A member can change their app preference without deleting the Portal account.

## Three distinct assurances

| Assurance | What it establishes | What it does not establish |
| --- | --- | --- |
| **Verified Portal member** | An approved real-person identity check and adult eligibility for Exchange participation | Control of a messaging app; real-world identity of an external chat peer |
| **Messaging-channel confirmed** (future) | That the member can receive/respond to a fresh Portal-issued confirmation challenge through the selected app | A government identity check, an immutable messaging identity, or a trusted conversation partner |
| **Peer identity checked** (inside messenger) | Locuto's explicitly completed contact verification, or Signal's safety-number check according to that app | Real-world identification of a person unless checked independently |

Never call a messaging challenge an "identity key." It is an **Agnus Dei confirmation code**, not a private encryption key, authentication recovery phrase, Signal registration code, or messaging PIN. Never ask for account secrets.

## Proposed Portal confirmation process

1. Only the signed-in, already verified adult can explicitly request an **optional channel confirmation**. Creating an account, viewing listings or passing the identity check never starts it.
2. Portal creates a short-lived, single-use, high-entropy challenge bound to that session/account and to the stated provider. Store only a salted/hash-bound verification record and timestamps; do not store full conversation contents or a durable app identity/phone-number mapping.
3. **Locuto (future):** design and security-review a native-client, consented challenge-delivery and response path that proves control of an endpoint without handing keys or Locuto delivery identifiers to the Portal. No native capability is assumed to exist now.
4. **Signal (future):** no trusted built-in Portal-to-Signal send/confirm integration has been established. Do not use undocumented or unofficial automation as if it were an authorized provider API. A human-operated, user-initiated review flow could be considered by product/security, but it would require a dedicated verified operator channel, anti-impersonation guidance, privacy treatment and explicit operational review. Until then, **show no automated channel-verified state**.
5. Confirm and consume exactly one challenge only through the approved implementation. Require expiry, cooldown, replay protection, proof freshness, service-side authorization, audit without code plaintext, and cancellation on account/provider change.
6. Record at most the minimal confirmation outcome/age for the member, under RLS and a retention policy. A confirmed channel is not an app identity directory and never grants Exchange privileges independently of human verification.
7. Treat a changed or revoked messaging account as unconfirmed until an approved recheck. Never automatically mark a Locuto contact trusted or a Signal safety number checked.

**Important:** Signal safety-number verification and Signal's optional automatic key verification do not establish real-world identity. A Signal username or contact link alone does not establish ownership. No operator or third-party service can truthfully claim automated Signal confirmation without a tested, supported delivery mechanism.

## Adult introduction

- Public listings contain no contact handles or phone numbers. Members must satisfy existing roles, consent and adult identity requirements to request contact.
- Recipient approval is required before anyone offers a channel-specific introduction. The introducer may choose either app; the other adult can accept, choose another app or decline.
- An approved introduction must not create a public member directory, automatically import a Locuto contact, or store Signal phone numbers as default identifiers.
- Locuto peer checks remain inside Locuto; Signal users should independently check safety numbers for sensitive conversations. Neither trust mark is a Portal verified-human badge.
- If the parties use different apps, show a courteous option to agree on one or close the request. No cross-app bridge, plaintext relay or unattended automated messenger may stand in for a person.

## Wording on the live Portal

- **Title:** “Choose how to keep in touch”
- **Intro:** “Locuto is recommended, and Signal is an option too. You don't need either app to be an Agnus Dei member.”
- **Locuto:** “Our private messenger. Available to choose after the official app release.”
- **Signal:** “Prefer Signal? Download it from the App Store or Signal's official website.”
- **Verification:** “We verify your identity separately. Messaging-account confirmation is not available yet, and we will never ask for a recovery phrase or private key.”
- **Existing inbox:** “Exchange replies in the Portal are not end-to-end encrypted. Please don't include sensitive details.”

The [messaging options page](../src/app/portal/messaging/page.tsx) is informational and functional as a route to official resources. It deliberately does not show an inactive verification button, an unverified Locuto App Store URL, or a fabricated completed link.

## Blockers before launching account confirmation

- [ ] Confirm Locuto's actual released iOS/Android clients, signed deep-link behavior, recovery UX and official App Store listing.
- [ ] Specify an approved, demonstrable challenge delivery/proof mechanism for each supported provider.
- [ ] Decide whether Signal gets a reviewed manual confirmation workflow or remains an external communication choice with no Portal channel-verification badge.
- [ ] Implement replay-safe short-lived challenges without storing provider identities or membership-to-messenger joins.
- [ ] Threat-model impersonation, device changes, shared accounts, phishing, malicious invites, verification bypasses and audit retention.
- [ ] Amend normative Locuto/Portal specs, review waiver and privacy disclosures, and prove member-only and agent-exclusion gates through real tests.
- [ ] Produce device-run and integration evidence before publishing any "messaging account confirmed" claim.

Official references: [Signal usernames](https://support.signal.org/hc/en-us/articles/6712070553754-Phone-Number-Privacy-and-Usernames), [Signal safety numbers](https://support.signal.org/hc/en-us/articles/360007060632-What-is-a-safety-number-and-why-do-I-see-that-it-changed).
