# Membership: real people only

**Policy:** Agnus Dei admits verified human beings as members. This is a standing, non-negotiable admission rule, including for the Portal's adults-only Exchange.

## Who can be a member

A member must be a real, living human being whose identity has been successfully verified through the approved process. The member must meet the age and role rules for the service they want to use. An account, payment, email address, passkey, or login session by itself is **not** proof of eligible membership.

In this policy, **bot** means any software, machine, agent, robot, AI-generated persona, automated actor, or other synthetic entity presented as a user, *including one acting as, claiming to represent, or operating under the identity of a real human*. Human sponsorship or delegation does **not** convert a synthetic actor into a member.

**Never admit as a member:**
- Anonymous or pseudonymous applicants whose underlying real-world identity cannot be verified through the approved process.
- Impersonators, fabricated people, synthetic identities, and accounts created for an entity that is not a human being.
- Bots, agent systems, robots, scripted identities, or any synthetic representative standing in for a human member.
- Applicants who have not completed identity verification, or whose verified identity has been revoked, invalidated, or placed into a state that prohibits participation.
- Accounts that try to share or transfer another person's identity or member privileges.

These exclusions are *policy invariants*, not risk scores, optional user settings, or features that a paid tier can waive. A manual review can correct an identity-verification error **only by establishing the person's eligibility through an approved verification method**; it cannot grant a synthetic entity membership.

## What remains possible

**Public browsing is not membership.** Someone may read the public co-op, curriculum, and listing information without opening a member account. Reasonable public access does not grant permission to post, reply, negotiate, transact, join member-only groups, or access any member directory.

**Software can assist without being a member.** The owner may use an assistive tool on their own device. Publicly available material may be read by ordinary software where permitted. A narrowly scoped service agent can perform expressly authorized *non-member* tasks such as summarizing published curriculum or diagnosing local security state, under a separate technical capability. But the agent may **not** apply for membership, impersonate a person, acquire a member's session or identity, post or reply *as* a member, accept connections, buy or sell, or approve membership. No unattended synthetic actor may enter the adult Exchange.

The current Portal's `GET /api/agents/tutors` endpoint uses a person's Supabase session for read-only discovery. **That existing implementation must be reviewed and redesigned** before describing it as satisfying this immutable rule: a human session is not an agent credential and does not make a bot an authorized member. Keep future agent capabilities separated from membership sessions.

**Privacy is compatible with verification.** Verifying the person does not mean exposing their legal name, documents, address, or cryptographic contact identifiers to other members or the public. It does mean authorized admission controls have dependable, independently checked evidence that the applicant is a real person.

**Household child accounts and Locuto contact identities are not Portal member accounts.** Do not use this membership rule to establish a directory of children, expose household learning records, or weaken Locuto's distinct contact-verification model. Participation in the Portal's Exchange remains strictly for verified adults.

## Enforcement and review (required before production admission claims)

1. **Identity first:** Reject membership and member-only activity unless a current approved verification attestation says the actual person is verified. No fallback to self-declared identity, email verification, account purchase, payment history, or a merely authenticated session.
2. **One accountable human:** Bind member privileges to the verified individual, with defined uniqueness/duplicate resolution and a documented privacy-preserving identity-reference strategy; avoid storing raw ID images or exposing legal identities in the public app.
3. **No machine principals:** Distinguish human interactive sessions from machine-issued credentials; a machine credential must never receive member entitlements or reuse a human session. Close existing read-only discovery API delegation gaps before expanding agent access.
4. **No scripted participation:** Post, reply, accept and any later member transaction must require a permitted, authenticated, verified human to initiate and approve the action. Add server-side protections, abuse limits and identity/session audits without falsely claiming bot detection is infallible.
5. **State changes revoke access:** Require explicit treatment of review, rejected, revoked, deceased (when reliably established), compromised and expired attestations, plus appeals with re-verification. A historical verified flag must not be treated as permanently valid by assumption.
6. **No privilege bypass:** Test direct HTTP actions, API endpoints, background jobs, agent and service tokens, role changes, invitations, retries, old sessions, and middleware bypasses. Denied automation must not acquire a member's permissions even if it carries an account identifier.
7. **No unsafe public exposure:** Do not publish a people directory, co-op family roster, member activity history or Locuto delivery identifiers. Child membership is not created via the Portal Exchange.
8. **Admission evidence:** Link deployment claims to verification provider controls, configured identity policy, integration tests, audit retention and security review. Do not claim all fake identities or automated abuse are preventable without such evidence.

## Human-facing wording

**Membership check:** “Agnus Dei membership is for real people. We'll ask you to verify your identity before you can participate. We don't publish your identity documents or personal details.”

**Unverified request:** “Your identity check needs to be completed before you can take part.”

**Declined request:** “We couldn't verify this application. You can request a review if you think there has been a mistake.”

This policy is the **Portal's proposed product admission rule**, accepted by the owner on 2026-10-10. It is not by itself an implemented technical guarantee. Cross-repository specification alignment and review remain in the [implementation checklist](implementation-checklist.md).
