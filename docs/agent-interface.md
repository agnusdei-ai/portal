# Agent interface — vetted tutor discovery (phase B)

Spec: the portal specification's tutor persona row and the "Tutor agent-to-agent
architecture" ruling of 2026-10-09 (option C, staged). Phase B is this API and
nothing more.

**The boundary in one sentence:** the portal returns trust and discovery data;
tutoring itself runs in household-owned systems. There are no tutoring sessions,
no chat, no model inference, and no messaging here, and this phase needs no
models. The portal does not broker contact — contact still travels the way it
always has: the exchange reply relay and the co-op directory's enquiry path.

## Who may call, and as whom

A household-owned agent system calls this API **as the verified adult's
principal**: it presents the account holder's own portal session (the Supabase
auth cookies of someone signed in to the portal). There are no API keys and no
separate token mint — the agent inherits exactly the session the operator has,
with every rule that session already carries: the 30-minute idle sign-out, and
the second factor when one is enrolled.

The gate composes the exchange's own enforcement, in the exchange's own order:

| Refusal (HTTP) | Meaning | What resolves it |
| --- | --- | --- |
| `unauthenticated` (401) | No valid session was presented. | Sign in to the portal, then retry with the session cookies. |
| `assurance-required` (403) | A TOTP factor is enrolled and the session is below AAL2. | Complete the second-factor challenge; the session is then AAL2. |
| `verification-required` (403) | The account holds no verified Socure attestation (including an OAuth sign-in that never completed the consent transaction and verification). | Complete adult verification at `/portal/verify`. |

Without an enrolled factor the first factor carries the session — the same
prompted-not-forced posture the exchange takes until an MFA recovery path
exists. Every refusal is `{"error": "<code>"}` with the status above; nothing
ever redirects.

## `GET /api/agents/tutors`

Query parameters: `limit` — 1..100, default 50. A value outside the range is
refused `{"error": "invalid-limit"}` with 400, not clamped. There is no
pagination in v1; the response is the full ordered result up to the limit.

```json
{
  "principal": {
    "account_id": "…",
    "verification_state": "verified",
    "classes": ["parent"]
  },
  "tutors": [
    {
      "account_id": "…",
      "classes": ["teacher"],
      "vouches": [
        {
          "class": "teacher",
          "vouched_at": "2026-10-01T00:00:00Z",
          "coop": { "id": "…", "slug": "riverbend", "name": "Riverbend Co-op",
                    "state_code": "TX", "region": "Houston metro" }
        }
      ],
      "axes": [{ "a": "parent", "b": "teacher" }]
    }
  ]
}
```

`Cache-Control: no-store` — trust data about other adults never sits in caches.

### Field dictionary, with the policy each field is read through

| Field | Sourced from | Why it may be shown |
| --- | --- | --- |
| `principal.account_id`, `principal.verification_state` | own account row and own attestation (RLS: "read own account", "account reads own attestation") | The gate proved both; echoing them gives an integrator a stable self-check. |
| `principal.classes` | `account_participants` (RLS: "read own classes") | The caller's own standing. |
| `tutors[].account_id` | `coop_affiliations` (RLS: "vouches are public") | An opaque handle, already public through the vouch policy; not joinable to any delivery identifier. |
| `tutors[].classes`, `tutors[].vouches[]` | `coop_affiliations` joined `coop_listings` (RLS: "vouches are public", "listed co-ops are public") | A vouch names an adult acting for an institution that chose to be named — the platform's published trust fact (docs/portal.md §6a). |
| `tutors[].axes` | `permitted_axes` (RLS: "axes are public") | The closed axis rows connecting one of the caller's classes to one of the account's vouched classes. |

### The axis rule

An account appears in `tutors` only when a permitted axis connects one of the
caller's classes to one of that account's vouched classes. A parent principal
sees vouched teachers (parent↔teacher); guides surface only to co-op
principals (guide↔co-op). Trust data about an account reaches exactly the
principals who could already communicate with its class.

### What is deliberately absent — the minimization boundary

- **No identity PII, ever.** No names, emails, phones, addresses, birthdates,
  document data, or account-owner identifiers. The only name anywhere in a
  payload is a co-operative's own name, which the public directory publishes.
- **No per-tutor verification state.** An attestation is RLS-private to its
  own account by design (migration 0003 has exactly one select policy).
  Exposing other accounts' verification would require the service role or a
  new policy — a new read surface the spec forbids. The vouch is the trust
  signal this API returns; the gate guarantees the *caller* is verified.
- **No contact details and no contact route.** No enquiry refs, no reply
  endpoints. Contact proceeds through the existing exchange relay or the co-op
  directory, under the communication waiver as always.
- **No scores, no profiles, no history.** A vouch is an institutional fact,
  not a rating; nothing here aggregates, ranks by trust, or persists anything.

## Rules for household systems

1. Use trust data inside the household's own systems; never re-publish it,
   and never treat `account_id` as a contact handle.
2. Respect the boundary: the portal performs no tutoring and so must yours
   through this API — bring your own scheduling, sessions, and models
   household-side.
3. The session is the operator's; if they sign out, go idle, or lose their
   second factor, the API refuses until they restore it. Handle all three
   refusal codes.
