# Portal → Locuto: decisions and work checklist

**Status:** product direction agreed, implementation not complete. Work on language and documentation first, then the membership gate, then the secure Locuto handoff. The private Locuto blueprint is tracked in [Locuto PR #375](https://github.com/agnusdei-ai/locuto/pull/375) and [Issue #374](https://github.com/agnusdei-ai/locuto/issues/374). The governing specification remains `agnusdei-ai/locuto/docs/portal.md`; this is the Portal delivery view.

## Accepted product direction

- [x] **D01 — Public discovery.** Curriculum, broad-area listings and co-op descriptions are freely browseable.
- [x] **D02 — Sensitive conversations.** The first private free-text message and sensitive arrangements will travel through Locuto E2EE, without plaintext fallback masquerading as private.
- [x] **D03 — Adults-only Exchange.** No children, family rosters, child educational details or public directory of people. Existing allowed adult role pairs remain closed.
- [x] **D04 — Human-only membership.** Every member must be a genuine, identity-verified human. No anonymous, fabricated or synthetic identities; no bots, agents, robots, software actors or synthetic representatives of any human may be admitted as members, regardless of delegation.
- [x] **D05 — No agent impersonation.** A non-member tool may assist only with separately scoped, approved tasks; it cannot impersonate a member, share their session, post/reply/accept/perform transactions on their behalf as a synthetic actor, or read Locuto messages.
- [x] **D06 — Separate trust checks.** A verified Portal member is not automatically a verified Locuto contact; peer cryptographic verification remains necessary.
- [x] **D07 — Consent boundaries.** The Exchange communication waiver, verified-adult membership, and Bede per-child consent and licensing are separate.

**Already-accepted policy is not a claim that the current code fully enforces it.** See [admission policy](member-admission-policy.md).

## Remaining decisions, with a proposed default

| ID | Owner to approve | Choice / proposed answer | Acceptance requirement |
| --- | --- | --- | --- |
| P01 | Product + security | v1 Locuto handoff: native app and out-of-band code verification first | No silent member-to-Locuto account mapping |
| P02 | Security | Remote invitation: defer until its interception, replay, MITM and revocation threats are reviewed | Unverified cannot be mislabeled Verified |
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

## Work ordered by dependency

- [ ] **W01 — Copy and stale-doc review**: rewrite visitor and member screens, remove old beta/release-date claims, make current unencrypted-reply disclosure conspicuous; align README, changelog, help and security guidance.
- [ ] **W02 — Human admission contract**: encode [membership policy](member-admission-policy.md), single person as principal, approved verification outcomes, failure/revocation states and machine exclusion. Add database, route and session tests.
- [ ] **W03 — Agent credential separation**: remove capability for an agent to act using a member's full session; replace read-only discovery with explicit, revocable, narrowly scoped non-member access only when authorized. No agent initiation of member activity.
- [ ] **W04 — Governing protocol alignment**: update the private Locuto specification and reconcile privacy, first contact, consent and abuse rules, without weakening child protection.
- [ ] **W05 — Adult-only interest requests**: model request/accept/decline/expiry in a separate store with RLS, server-side gates and fixed-format content. No automated member actions.
- [ ] **W06 — Locuto client handoff**: explicit opt-in and authenticated out-of-band peer verification; keys never touch the Portal. Native-client interoperability evidence.
- [ ] **W07 — Retire readable private replies**: introduce a reviewed cutover, accurately update waiver, preserve historical retention rules and audit old routes.
- [ ] **W08 — Moderation and agent safety**: voluntary message evidence, metadata-minimizing safeguards, per-member request limits, no unauthorized agent side effects.
- [ ] **W09 — Release proof**: type-check, tests, build, RLS isolation, verification abuse tests, bot/impersonation exclusions, device/crypto evidence, accessibility and independent security review.

## Documentation that must stay synchronized

- `README.md`: current code versus future integration, and remaining licensing decisions.
- `CHANGELOG.md`: replace elapsed 2026-09-30 launch target and unsupported early beta/security claims.
- `SECURITY.md`: maintain pre-release status; current Portal replies remain operator-readable.
- `docs/agent-interface.md`: current authenticated read-only endpoint is **not** a machine entitlement to human membership.
- `src/lib/docs/content.ts`: human-centered help; no invented agent/Locuto features.
- `src/lib/consent/waiver.ts`: legal disclosure remains accurate until implementation changes; edit with counsel review and versioning.
- Private Locuto `docs/portal.md`, `identity.md`, `user-safety.md`, `agents.md` and release matrix: differentiate normative rules, approved direction and working code.

**Do not mark tasks done without a verified commit, tests and (when relevant) deployment evidence.** The copy branch and the encryption implementation are intentionally separate.
