# Portal messaging: decisions and work checklist

**Status:** product direction agreed, implementation not complete. Work on language and documentation first, then the membership gate, then the secure Locuto handoff. The private Locuto blueprint is tracked in [Locuto PR #375](https://github.com/agnusdei-ai/locuto/pull/375) and [Issue #374](https://github.com/agnusdei-ai/locuto/issues/374). The governing specification remains `agnusdei-ai/locuto/docs/portal.md`; this is the Portal delivery view.

## Accepted product direction

- [x] **D01 — Public discovery.** Curriculum, broad-area listings and co-op descriptions are freely browseable.
- [x] **D02 — Sensitive conversations.** Private conversations may take place in Locuto (preferred) or Signal, chosen by the adults involved. Do not represent the Portal's existing plaintext reply inbox as encrypted.
- [x] **D03 — Adults-only Exchange.** No children, family rosters, child educational details or public directory of people. Existing allowed adult role pairs remain closed.
- [x] **D04 — Human-only membership.** Every member must be a genuine, identity-verified human. No anonymous, fabricated or synthetic identities; no bots, agents, robots, software actors or synthetic representatives of any human may be admitted as members, regardless of delegation.
- [x] **D05 — No agent impersonation.** A non-member tool may assist only with separately scoped, approved tasks; it cannot impersonate a member, share their session, post/reply/accept/perform transactions on their behalf as a synthetic actor, or read Locuto messages.
- [x] **D06 — Separate trust checks.** Portal identity, messaging-channel control, and the peer trust checks in Locuto or Signal are different claims.
- [x] **D07 — Consent boundaries.** The Exchange communication waiver, verified-adult membership, and Bede per-child consent and licensing are separate.
- [x] **D08 — Optional messaging.** Locuto is preferred; Signal is an alternative. Neither is a condition of membership or identity verification.
- [x] **D09 — Separate confirmation.** A messaging-app confirmation demonstrates channel access, not real-world identity. Never request an app's account or recovery secrets.

**Already-accepted policy is not a claim that the current code fully enforces it.** See [admission policy](member-admission-policy.md).

## Remaining decisions, with a proposed default

| ID | Owner to approve | Choice / proposed answer | Acceptance requirement |
| --- | --- | --- | --- |
| P01 | Product + security | Optional private messaging: Locuto (recommended), Signal, or no app until needed | Membership remains available without messaging setup |
| P02 | Security | Locuto out-of-band peer check or Signal's own contact link and safety-number checks; no silently trusted introduction | App control and peer trust are not confused with human identity |
| P03 | Product + safety | First-contact request: fixed interest types with no user-written message | No plaintext pre-chat sensitive material |
| P04 | Safety + security | Request expiry, sender limits, decline/block and reporting policy | Verified actors only; abuse tests |
| P05 | Security + identity vendor | Identity assurance: define liveness, synthetic-ID and impersonation detection, uniqueness, expiry, recheck, revocation and manual re-verification | Verified flag is evidence-backed and not permanently trusted by default |
| P06 | Platform + security | Human-vs-machine separation: a machine cannot hold/reuse a member cookie; retire or redesign the existing agent API's direct session delegation | Agent access only via separately scoped, non-member permission |
| P07 | Product + security | Human-action approval and anti-automation measures for protected writes | Bots cannot act as Exchange participants even through scripts or proxy calls |
| P08 | Legal + safety | Abuse reporting and message evidence for future E2EE | Reporting does not grant a hidden operator reader |
| P09 | Legal + finance | Marketplace payments not supported in v1; later use reviewed processor | Consent/payment terms remain separate |
| P10 | Security + legal | Old plaintext reply handling, retention, notice and migration | No silent import of readable messages into Locuto |
| P11 | Platform | Portal hosting/TLS, session separation, MFA, CI, rollback and monitoring | Security checks tied to exact deployment commit |
| P12 | Product + platform | Browser encrypted client only if native phase passes evidence gates | No home-grown browser encryption |
| P13 | Legal + product | Co-op self-service, parent consent eligibility and hosted/self-hosted licensing | No unshipped UI promises or policy shortcuts |
| P14 | Security + product | Confirm delivery feasibility for an optional Locuto challenge; defer automatic Signal confirmation absent a reviewed integration | No unsupported provider identity claim |
| P15 | Security + privacy | Approve challenge lifetime, confirmation method, anti-replay, retention, account scoping and cancellation | Only a recent provider proof earns a channel confirmation label |
| P16 | Product + safety | Adults using different apps, or none, can decline/defer an introduction without losing membership | No forced app installation |
| P17 | Product | Add Locuto's official App Store link after independent verification of release | No invented or premature download link |

## Work ordered by dependency

- [ ] **W01 — Copy and stale-doc review**: rewrite visitor and member screens, remove old beta/release-date claims, make current unencrypted-reply disclosure conspicuous; align README, changelog, help and security guidance.
- [ ] **W02 — Human admission contract**: encode [membership policy](member-admission-policy.md), single person as principal, approved verification outcomes, failure/revocation states and machine exclusion. Add database, route and session tests.
- [ ] **W03 — Agent credential separation**: remove capability for an agent to act using a member's full session; replace read-only discovery with explicit, revocable, narrowly scoped non-member access only when authorized. No agent initiation of member activity.
- [ ] **W04 — Governing protocol alignment**: update the private Locuto specification and reconcile privacy, first contact, consent and abuse rules, without weakening child protection.
- [ ] **W05 — Adult-only interest requests**: model request/accept/decline/expiry in a separate store with RLS, server-side gates and fixed-format content. No automated member actions.
- [ ] **W06 — Optional messaging guidance**: functional choice page, Signal official download links, and Locuto App Store link only after release. Never force a provider at signup.
- [ ] **W06a — Channel confirmation**: provider-specific, consented one-time challenge only after real delivery and confirmation mechanisms exist. Signal integration remains unproven; no channel-verified badge yet. See [messaging channel design](messaging-channels.md).
- [ ] **W06b — Peer verification**: Locuto verification and Signal safety numbers remain app-specific and distinct from Portal member identity.
- [ ] **W07 — Retire readable private replies**: plan an honest transition to mutually selected external private messaging, accurately update waiver, and retain lawful history. Where no shared app is chosen, don't provide a hidden plaintext private-chat fallback.
- [ ] **W08 — Moderation and agent safety**: voluntary message evidence, metadata-minimizing safeguards, per-member request limits, no unauthorized agent side effects.
- [ ] **W09 — Release proof**: type-check, tests, build, RLS isolation, verification abuse tests, bot/impersonation exclusions, device/crypto evidence, accessibility and independent security review.

## Documentation that must stay synchronized

- `README.md`: current code versus future integration, and remaining licensing decisions.
- `CHANGELOG.md`: replace elapsed 2026-09-30 launch target and unsupported early beta/security claims.
- `SECURITY.md`: maintain pre-release status; current Portal replies remain operator-readable.
- `docs/agent-interface.md`: current authenticated read-only endpoint is **not** a machine entitlement to human membership.
- `src/lib/docs/content.ts`: human-centered help; no invented agent or messaging-app checks.
- `docs/messaging-channels.md`: provider choice, assurance boundaries and unresolved channel confirmation.
- `src/app/portal/messaging/page.tsx`: informational options only; Signal links are verified, Locuto listing pending.
- `src/lib/consent/waiver.ts`: legal disclosure remains accurate until implementation changes; edit with counsel review and versioning.
- Private Locuto `docs/portal.md`, `identity.md`, `user-safety.md`, `agents.md` and release matrix: differentiate normative rules, approved direction and working code.

**Do not mark tasks done without a verified commit, tests and (when relevant) deployment evidence.** The copy branch and the encryption implementation are intentionally separate.
