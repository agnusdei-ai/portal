# Security policy

Portal handles privacy-sensitive flows: parental-consent records, identity
verification, payments-as-consent, and authenticated account access. Treat
anything that exposes, alters, or stands in for those flows as a potential
security report.

## Status

Portal is pre-release. No public version is currently supported, and
neither the default branch nor the October 2026 copy review is a statement
of deployment or release readiness. Reports are welcome against the code
as it stands.

Exchange replies currently remain readable by the Portal operator and are
**not end-to-end encrypted**. The proposed Locuto handoff is a separate
integration that needs implementation, interoperability tests and security
review before any new confidentiality claim.

The member-admission policy excludes all non-human principals, including bots,
AI agents and synthetic representatives of humans. The current read-only
tutor discovery API still uses a human's session, so agent credential separation,
identity assurance and anti-automation controls are **open security work**, not
claims of already-complete enforcement. See [the admission policy](docs/member-admission-policy.md).

| What | Where |
| --- | --- |
| Supported versions | None. No public release exists. |
| Deployment posture | Self-hosted Next.js app; Supabase auth, Stripe, and Socure integrations. |
| Bug bounty | None. |

## Reporting

**Use [GitHub private vulnerability reporting](https://github.com/agnusdei-ai/portal/security/advisories/new).**
Reports stay access-controlled to maintainers — do not put exploitable details
in a public issue.

If that link does not resolve, the repository setting is not enabled. Open a
regular issue saying only that you have a security report and no private
channel to send it through — naming nothing about the finding — and a
maintainer can enable the setting and follow up.

Please include enough to reproduce or evaluate the claim: the affected file or
component, the assumption under attack, the observed behavior, and what an
adversary gains. A proof-of-concept is welcome when it can be produced safely
against a local or owned test environment; it is not required.

Of particular interest:

- Anything that reads, writes, or bypasses consent records or verification state.
- Webhook handling (Stripe, Socure): signature verification, replay, body parsing.
- Auth and MFA enrollment flows (Supabase auth, TOTP).
- Anything that lets one family or account read another's data (RLS boundaries).

## What to expect

| Stage | Target |
| --- | --- |
| Acknowledgment | 5 working days |
| Initial assessment | 21 days |
| Public disclosure | 90 days from report, or on fix, whichever is sooner |

The 90-day clock is a commitment to the reporter, not a request for indefinite
silence. If the project has not responded meaningfully in that window, the
reporter may publish.

## Credit

Reporters are credited by name, handle, or not at all, entirely as they prefer.
Tell us which.
