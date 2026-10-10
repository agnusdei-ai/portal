# Changelog

Changes to Agnus Dei Portal are recorded here when the corresponding code and tests are available. This repository is **pre-release**; its current `main` branch is not a supported public release.

## Unreleased — copy and documentation review (2026-10-10)

### Proposed
- Clearer language across the homepage, navigation, curriculum, co-op directory, Exchange, replies, member home, and onboarding.
- Updated developer and help documentation to separate what works today from what is planned.
- A Portal-to-Locuto private-messaging handoff, with decisions and security requirements tracked in the private Locuto blueprint. **Not implemented in this Portal.**

### Current boundaries
- The Exchange currently stores replies in the Portal; **they are not end-to-end encrypted**, and the service operator can read them.
- The verified-adult account workflow, permitted exchange roles, communication waiver, per-child consent/licensing model, and narrow tutor discovery API are separate functions; they do not mean tutor sessions or private messaging are hosted here.
- Co-op member rosters and children's learning records do not belong in the hosted Portal.
- No general-availability date or certification is asserted. Security and deployment readiness require their own evidence.

## v0.1 — initial scaffold (2026-08-15)

This was an **early development milestone**, not proof that every planned feature was delivered. The old beta label, September 30, 2026 general-availability target, and blanket claims of secure member messaging, complete moderation tooling, and household deployment support have been removed because they were not backed by a release-evidence inventory.

The application includes public discovery, an adults-only Exchange with readable reply messages, and account/consent structures under development. For current feature and verification details, see the [README](README.md) and [security policy](SECURITY.md).

## Before declaring a release

- Validate the exact commit with type-checking, tests, and a production build.
- Verify account and payment/consent flows, abuse handling, data isolation, deployment controls, and mobile accessibility.
- Obtain the required product, security, and legal reviews for any new claims.
- Describe Locuto E2EE as available in the Portal only after an actual interoperable, tested release.
