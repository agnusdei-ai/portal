# Portal Launch Blueprint

**Status:** Proposed, revision 2. Not normative. The governing specification remains `agnusdei-ai/locuto/docs/portal.md`, and it wins wherever this document disagrees. Nothing here counts as done until a verified commit, passing tests, and deployment evidence exist, which is the rule the implementation checklist already sets.

**Decision recorded in this revision:** Counsel has confirmed that an opaque, parent-only seat label is acceptable consent evidence. The label has no association with any real child identification record. This clears the previous legal dependency on the seat-label migration.

**Purpose:** Define one ordered path to a hardened, hosted initial release of the Portal, including a public catalog of homeschool and classical learning resources, with agents used as supervised builders and never as members.

## 1. Principles

1. **Delegate to managed services, retain control of data boundaries.** Vendors supply TLS, DDoS protection, patching, and certifications. The Portal supplies row-level security, consent integrity, and minimal data.
2. **Store the least possible.** The hosted zone holds no child name, no child identifier, and no learning history.
3. **Agents are builders and operators, never members.** The membership policy and agent interface document forbid bots from posting, replying, joining, accepting contacts, or transacting as a member.
4. **Every claim is evidenced.** Privacy copy, security claims, and compliance statements must match shipped behavior.
5. **One approver per irreversible action.** No agent both produces and approves a change that reaches production or the public catalog.

## 2. Target architecture

| Layer | Choice | Role |
|---|---|---|
| Edge | Cloudflare proxy, strict TLS, WAF | TLS termination, DDoS, rate limiting, bot challenge |
| Application | Phase 1 on Render; optional later trial on Cloudflare Workers | Next.js application |
| Data and auth | Supabase (Postgres, Auth, row-level security) | System of record |
| Observability | Grafana Cloud free tier, Sentry, Cloudflare Alerts | Metrics, errors, edge events |
| Source control and CI | GitHub, protected `main`, required checks | Change control |
| Agent tooling | Codex and Claude through scoped MCP servers | Supervised development and diagnostics |

Render holds SOC 2 Type 2 and ISO 27001 attestations for the platform. Platform compliance does not remove the customer's own configuration responsibilities. Render also provides private networking and environment groups for secrets.[1][2]

### Workers decision

The Workers runtime is a V8 isolate with Node compatibility shims, not full Node.js. The compressed Worker size limit is 3 MiB on the free plan and 10 MiB on the paid plan. Cloudflare directs new Next.js work toward its vinext path. Decision: stay on Render for the initial release. Trial Workers in a separate environment, and cut over only if the existing tests pass unchanged.[3][4][5]

### Rate limiting decision

Cloudflare rate-limiting rule fields depend on plan tier, so per-member limits belong in application code, with Cloudflare as a coarse outer layer. Turnstile covers signup, login, and Exchange writes at no per-request cost, without a service-level agreement.[6][7]

## 3. Data model decisions

### 3.1 Seat label replaces child name (decided)

The consent schema currently stores `child_account_name`, referenced in seven files: the setup action, consent record logic, consent page, notice form, shared types, schema, and one test. The schema documents it as the sole permitted child-keyed datum in the hosted zone.

**Decision:** Replace it with `seat_label`. The portal never interprets the label and holds no child name or identifier.

**Format:** `<parent-word>.<code>`, for example `lantern.k7q2`.

- The parent word is chosen by the parent for private recognition.
- The code is four to six random characters from an alphabet without look-alike characters. It is unique per account and resolves duplicate words without any identifying attribute.
- The seat's random identifier is the internal key. The label is display-only.

**Rules:**

- Warn when the word resembles a common given name, initials, a birthdate, or a school.
- A rename overwrites the previous value, with no label history.
- Labels never appear in logs, error trackers, analytics, exports, or agent-readable surfaces.
- Only the owning account reads its labels, enforced by row-level security.
- The label is not a credential, a profile name, a directory entry, or a contact handle. It is not identity proof or age verification.

**Consent evidence retained:** notice version and hash, timestamp, authenticated adult account identifier, and the payment or consent instrument where applicable, plus the label itself.

**Notice wording requirement:** The notice states that the label is private, chosen by the parent, and must not contain a child's name, initials, birth date, school, or other identifying information.

**Household link:** The household build keeps any mapping between a seat identifier and a real child or curriculum. That mapping never enters the portal.

**Residual risk:** A parent can still type a real name into the word field. The notice and the warning reduce this, and labels stay treated as sensitive in backups and logs.

### 3.2 Remaining legal questions

The FTC states that COPPA does not apply to information about children collected online from parents or other adults, because the Rule covers only information collected from children. The amended Rule's compliance deadline for in-scope operators was April 22, 2026. The seat-label question is closed. Remaining items for counsel are narrow:[8][9]

- Whether state privacy or minors' data laws apply independently.
- Whether the identity vendor's checks trigger separate biometric laws.
- Whether privacy and security copy is accurate, given that Exchange replies are operator-readable.
- Whether any future child-facing Bede feature changes the analysis.

### 3.3 Encryption

Supabase encrypts projects at rest by default, and does not recommend Transparent Column Encryption, which is pending deprecation. Supabase Vault stores encrypted secrets. Use application-layer encryption where a field must stay unreadable to the database operator. Exchange messages are operator-readable by design and must not be described as end-to-end encrypted.[10][11]

## 4. Authentication and authorization

| Layer | Control |
|---|---|
| Member authentication | Supabase Auth, required multi-factor authentication, 30-minute idle sign-out |
| Human-only admission | Verified adult, single person as principal, machine exclusion |
| Authorization | Row-level security is the enforcement point; application checks are convenience |
| Operator access | Cloudflare Access with multi-factor authentication, separate from member sessions |
| Agent access | Separately scoped, revocable, non-member permission; never a member session |

The existing tutor discovery API presents the adult's own session cookies. This is a documented gap that must be replaced by a restricted non-member permission before any unattended agent access. Do not extend it until then.

## 5. Agent roster

| Agent | Responsibility | Access | Prohibited |
|---|---|---|---|
| Source scout | Propose publishers and open-licensed collections | Public web, read-only | Database writes |
| Extractor | Produce structured candidate records | Staging table only | Publishing, account access |
| Verifier | Validate links, duplicates, schema, license status | Reads staging | Approving its own output |
| Classifier | Propose subject and grade tags with source text | Reads staging | Setting Bede support from observed usage |
| Human reviewer | Approve, edit, or reject records | Only path to public tables | Not applicable |
| Security reviewer | RLS, secrets, logging, dependency checks on every pull request | Repository, read-only | Merging |
| Test agent | Write and run tests, including schema invariants | Repository, CI | Production deployment |
| Operations agent | Read-only diagnostics on staging | Scoped MCP, approval on writes | Production consent tables |

### Codex and MCP controls

Codex reads MCP servers from `config.toml`, supports OAuth login or bearer tokens from environment variables, and allows per-server tool allow lists and approval modes. Required settings: an allow list of enabled tools per server, approval required for writes, and no credentials in committed files.[12][13][14]

For Supabase, scope the MCP server to one project, enable read-only mode, and restrict feature groups. Supabase warns the server runs with the developer's permissions and must not be exposed to customers or end users. Use a staging project with synthetic data only.[15]

### Cloudflare tokens

Use separate tokens by task. Binding a Secrets Store secret to a Worker requires both the Secrets Store Edit permission and a secret scoped to Workers. Managing one Worker's secrets can be granted through a Workers role scoped to that Worker. No agent token may touch DNS, WAF rules, or account membership.[16][17]

## 6. Catalog ingest pipeline

**Scope:** metadata and links only. No copying of publisher text, curriculum pages, or sample materials. Unclear copyright status is treated as copyrighted.

1. **Approved source list:** a human-approved list of publishers, with each source's terms recorded.
2. **Collect:** title, publisher, subject, grade range, philosophy, URL, retrieval date.
3. **Stage:** candidates land in a staging table with source URL and agent run identifier.
4. **Validate:** schema checks, link checks, duplicate detection, and a mandatory published source for every record.
5. **Review:** a human approves each record or batch before it reaches `curricula` or `resource_links`.
6. **Publish and audit:** record the approver and time, and re-check links on a schedule.

**Hard rules:**

- `bede_support` derives only from published sources, never from observed family usage.
- No child, family, or roster data enters the public zone.
- No marketplace payments in version 1, per the checklist.

## 7. Observability and operations

| Need | Tool | Notes |
|---|---|---|
| Errors | Sentry free plan or GlitchTip | Free Sentry is one user with email alerts[18] |
| Metrics, logs, traces | Grafana Cloud free tier | 10,000 metric series, 50 GB logs, 50 GB traces, 14-day retention[19] |
| Edge and Worker logs | Workers Logs and Cloudflare Alerts | Free plan retention is short; pricing changes December 1, 2026[20] |

**Alert on:** repeated authentication failures, multi-factor resets, payment webhook signature failures, service-role key use outside expected server paths, row-level security errors, cross-account access attempts, certificate problems, and error spikes. Every alert carries the deployed commit identifier.

**Never log:** seat labels, consent details, license tokens, session cookies, or message content. A continuous-integration test fails the build if those fields appear in log output.

**Retention:** Grafana's free tier keeps 14 days, so audit evidence must be exported to storage the operator controls.

**On-call:** One named administrator at launch is a single point of failure. Name a second administrator before the pilot.

**Runbooks required before launch:** key rotation, suspected data exposure, rollback, and certificate failure.

## 8. Phased plan

| Phase | Outcome | Exit gate |
|---|---|---|
| 0. Decisions | Seat-label decision confirmed. Still open: where Bede runs, product framing and price, curriculum support method | Decisions recorded in the specification; landing page privacy copy corrected or removed |
| 1. Foundations | Reviewed MFA, abuse-control, and CI branches merged; human-admission contract; session delegation removed from the agent API | Tests for human exclusion and RLS isolation pass |
| 2. Seat label | Migration, generator, forms, types, notice version bump, RLS, log-scrub, and agent-surface tests | No child name column remains; notice hash updated |
| 3. Catalog | Staging, validation, human review; seed of about 50 reviewed records | Every record sourced, reviewed, and link-checked |
| 4. Hosting | Cloudflare edge, Render origin locked to Cloudflare, Supabase network restrictions, monitoring, runbooks | Security evidence pinned to the deployed commit |
| 5. Pilot | Limited release with human reviewers | Independent security review complete |

## 9. Release gates

- Type-check, unit tests, build, and the schema-invariant test pass.
- Every table has row-level security, verified by an automated test.
- Cross-account access attempts fail in tests.
- Secret scanning is clean, and the service-role key never appears in client code.
- No seat label, consent, token, or message data appears in logs or agent-readable responses.
- Every catalog record has a source, a reviewer, and a working link.
- Bot and impersonation exclusion tests pass.
- The remaining counsel items in section 3.2 are answered or accepted as known risk.
- Security evidence is tied to the exact deployed commit.

## 10. Open decisions

1. Where Bede runs: household only, or hosted components as well.
2. What Bede is sold as, and at what price.
3. How curriculum support is determined from published sources.
4. Whether hosted per-account enclaves are needed, or row-level security satisfies the sovereignty goal. Kubernetes with vCluster stays deferred until this is decided.
5. The approved first source list and the reviewers' weekly capacity.
6. Link-out only versus hosting any materials.
7. The second on-call administrator.
8. Licensing lane for the Locuto core, which the decision register still treats as unresolved.

## 11. Document control

Record each decision here as a dated verdict, then mirror it into the specification's decision register. Reconcile this document against `portal.md` before every release, and keep the implementation checklist as the single source of task status. Revision 2 records the counsel confirmation on the seat label.

## Sources

[1] Render Platform Compliance and Certifications https://render.com/docs/certifications-compliance
[2] Secure AI Deployment: SOC 2, Private Networking & Secrets https://render.com/articles/secure-ai-deployment-soc2-private-networking
[3] Deploy a Next.js App Router App to Cloudflare Workers https://dev.to/royalpinto007/deploy-a-nextjs-app-router-app-to-cloudflare-workers-with-opennext-and-a-d1-database-16j0
[4] OpenNext for Cloudflare https://opennext.js.org/cloudflare
[5] Next.js on Cloudflare Workers https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
[6] Cloudflare rate limiting rules https://developers.cloudflare.com/waf/rate-limiting-rules/
[7] Cloudflare Turnstile pricing https://prosopo.io/tools/cloudflare-turnstile-pricing/
[8] Complying with COPPA: FAQ https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
[9] FTC COPPA enforcement update https://www.davispolk.com/insights/client-update/ftc-prioritizes-coppa-enforcement-new-compliance-obligations-take-effect
[10] Supabase pgsodium (pending deprecation) https://supabase.com/docs/guides/database/extensions/pgsodium
[11] Supabase Vault https://supabase.com/docs/guides/database/vault
[12] Codex MCP handbook https://codexhandbook.com/en/skills/mcp/connect-an-mcp-server/
[13] Codex MCP config https://codexinsider.com/config/connect-an-mcp-server/
[14] Codex MCP setup https://agentscamp.com/guides/mcp/codex-mcp-setup
[15] Supabase MCP server https://supabase.com/docs/guides/ai-tools/mcp
[16] Cloudflare Secrets Store access control https://developers.cloudflare.com/secrets-store/access-control/
[17] Cloudflare Workers roles https://developers.cloudflare.com/workers/authorization/workers/
[18] Sentry pricing https://sentry.io/pricing/
[19] Grafana Cloud pricing https://monitoringcost.com/grafana-cloud-pricing
[20] Cloudflare Workers Logs https://developers.cloudflare.com/workers/observability/logs/workers-logs/
