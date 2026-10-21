# Amendment 1 to the Portal Launch Blueprint: Exchange Data Minimization

**Applies to:** `docs/portal-launch-blueprint.md`, revision 2.
**Status:** Proposed. Not normative. The specification at `locuto/docs/portal.md` governs on any conflict.
**Insert:** as new section 3.4, with the additions to sections 8, 9, and 10 listed in section 6 below.

## 1. Purpose

The Exchange is a hosted, operator-readable marketplace for materials and announcements. Its design goal is to hold as little personal information as possible, so that a breach exposes little. This amendment turns that goal into enforceable rules, tests, and release gates.

## 2. Rationale

The 2014 eBay breach exposed names, usernames, encrypted passwords, email addresses, physical addresses, phone numbers, and dates of birth. Financial data was reported as not taken. The intrusion began with compromised employee credentials. Two lessons apply: hold fewer identity fields, and protect operator access more strictly than member access.

A low-PII exchange still has exposure that does not depend on field count. Researchers reported an eBay flaw that revealed a buyer's purchase history to visitors. The Exchange equivalent is activity metadata: who posted, replied to, or followed which listing or co-op.

## 3. Allowed data

| Object | Allowed fields | Not allowed |
|---|---|---|
| Account | Random account ID, email, authentication state, verified-adult flag | Legal name, address, phone, date of birth |
| Seat | Random seat ID, `seat_label`, billing state | Child name, initials, age, school, child identifier |
| Listing | Title, category, subject, grade range, description, link, price if any | Contact details in free text, photographs of children |
| Reply | Body, listing reference, author account ID, timestamp | Attachments in version 1 |
| Co-op listing | Name, topic, general region such as state or metro | Street address, roster, member list |
| Payment (future) | Processor account reference, payment status | Card data, seller identity documents, tax identifiers |

Any new field requires an entry in this table and a reviewer's approval before it is merged.

## 4. Rules

### 4.1 Free text

- Show a posting reminder on every free-text field: do not include a child's name, school, address, or phone number.
- Provide a report action on every listing and reply, and a removal path with a stated response target.
- Apply the same log-scrub rule used for seat labels: no listing or reply body appears in logs, error traces, analytics, or agent context.

### 4.2 Operator-readable replies

- State plainly in the notice and the interface that Exchange replies are readable by the operator and are not end-to-end encrypted.
- Do not describe the Exchange as private or secure messaging.
- Keep Exchange content off the Locuto relay, as the specification already requires.

### 4.3 Metadata exposure

- Listings are public only by explicit design. Reply threads are visible only to their participants.
- No public view shows an account's reply history, saved items, or follows.
- Account and seat identifiers shown publicly must be unlinkable to the account's email.

### 4.4 Retention

- Reply threads expire after a stated period, proposed at 12 months, unless both parties keep them.
- Deleted listings and replies are removed from backups on the normal backup rotation, and the notice states that period.
- Reports and moderation records keep only the listing reference, reason, action, and reviewer.

### 4.5 Operator access

- Operator access to replies requires multi-factor authentication, uses a role separate from member sessions, and writes an audit entry for each read.
- Reading reply content is limited to reported items and defined support cases.
- Agents never read reply bodies. Agent access to the Exchange is limited to counts and metadata needed for diagnostics.

### 4.6 Payments, if added after version 1

The blueprint defers payments, matching the implementation checklist. If payments are added:

- Use a processor that tokenizes card data and performs seller identity checks, so the portal never handles either. Stripe Connect is designed for marketplaces that route money among several parties.
- Stripe collects identity information from connected accounts, and the platform's responsibilities for that data are set by Stripe's guidance. The portal stores only the processor's account reference and status.
- Stripe states that it does not provide escrow accounts. Any hold-until-delivery or refund-on-refusal design needs counsel and Stripe's written confirmation before it is described to users.

## 5. Tests and evidence

| Test | Passes when |
|---|---|
| Field allow-list | Schema contains no column outside the table in section 3 |
| Row-level security | Non-participants cannot read replies; no account can read another account's activity |
| Log scrub | Listing text, reply text, labels, and tokens are absent from logs and error output |
| Agent surface | Agent endpoints return no reply bodies or labels |
| Retention job | Expired threads are removed, and the job's run is logged without content |
| Operator audit | Every operator read of a reply writes an audit entry |
| Notice accuracy | Interface copy matches section 4.2 and has no claim of private or encrypted replies |

## 6. Changes to the blueprint

- **Section 3.4 (new):** insert sections 3 and 4 of this amendment as "Exchange data minimization."
- **Section 8, Phase 3:** add the allow-list and retention job to the exit gate.
- **Section 9, release gates:** add the seven tests in section 5 above.
- **Section 10, open decisions:** add "Reply retention period" with proposed 12 months, and "Operator reply-access cases" to be defined with counsel.
- **Section 11:** record this amendment as a dated verdict.

## 7. Queue additions for the agent loop

| ID | Task | Gate |
|---|---|---|
| G01 | Field allow-list test for the Exchange schema | `npm test -- allowlist` |
| G02 | Row-level security tests for replies and activity metadata | `npm test -- rls` |
| G03 | Retention job for reply threads, with content-free logging | `npm test -- retention` |
| G04 | Operator read audit log | `npm test -- audit` |
| G05 | Posting reminder and report action on listings and replies | `npm test -- exchange-ui` |
| G06 | Notice copy check for operator-readable replies | `npm test -- notice` |

Retention length and operator-access cases are human decisions. The loop must write `BLOCKED.md` on G03 and G04 until those are recorded in `DECISIONS.md`.
