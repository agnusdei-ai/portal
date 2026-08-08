# Agnus Dei — parent portal

**`locuto/docs/portal.md` is normative over this repository.** Where this code and
that document disagree, that document governs and this code is wrong. Read it
before changing anything here.

## The three zones

| Zone | Auth | Holds |
| --- | --- | --- |
| **Public** | none, indexable | Curriculum catalogue, resource links, co-op listings, the exchange |
| **Portal** | after the consent transaction | The account, seats, billing, and the consent record |
| **Household** | not here at all | Children, the child-to-curriculum join, tutoring configuration, Bede |

The third zone is the one to understand. Children and everything about what they
study live on hardware the household owns. `storage.md` §10.2 resolves the
plaintext boundary as client-side only and reads client-side to include
household-hosted, so a Bede built inside a home is *inside* the trust boundary and
may read all of it. What is excluded is any path carrying it out of the household,
including a third-party model API however strong its contractual guarantees.

**This schema therefore has no `students` table, no child-to-curriculum join, and
no co-op roster.** That is not an omission to be filled in later.
`parental-consent.md` §4 requires the separation to be structural rather than
procedural, so `tests/schema-invariants.test.mjs` fails the build if any of them
reappears.

## The transaction is three things at once

`parental-consent.md` §3 makes the parent's payment-card transaction the verifiable
parental consent: the issuer's notification to the cardholder is what supplies
verification. `docs/portal.md` §3 puts the public-to-portal boundary at the same
event. So one charge is simultaneously the paywall, the consent instrument and the
data boundary, and three things follow.

**It must be a genuine captured charge.** An authorisation hold released without
notice, or a zero-amount trial, notifies nobody and silently voids the consent
method. `src/lib/billing/checkout.ts` uses `mode: "payment"` with automatic
capture for this reason.

**Nothing keyed to a family may exist before it.** The account row is created in
the webhook, after the charge succeeds, not at the start of setup. An abandoned
setup leaves nothing behind because there was nothing to leave.

**There is no free tier that reaches a child-keyed object.**
`counsel-packet-40.md` records that a free tier, an institutional seat or a gift
subscription each break the payment-card route, and decision 61 is unanswered.

The one exception to "no family object before the charge" is the consent record
itself, which must precede it: §2 puts the notice acknowledgement before the
consent step, and §4 retains the time of both to evidence the ordering.

## The exchange, and why it does not endanger the safety claim

`user-safety.md` §2 certifies that a stranger cannot find a child and cannot
initiate contact. A brokering service is strangers finding each other, so the
exchange is built to leave that claim untouched:

- Posting and replying require an account, which exists only behind the §3 card
  transaction. The paywall doubles as an adult check.
- A listing is not a contact endpoint. Replies land in the portal, never in
  Locuto, and consume no delivery identifier.
- Becoming Locuto contacts remains the ordinary out-of-band code ceremony.
- Listings expire in thirty days, carry a region rather than an address, and are
  validated against contact details and street addresses (`src/lib/exchange/schema.ts`).
- There are no profiles, no posting history and no reputation score. A reputation
  system is a person-directory with a number attached.

**Tutoring, childcare and lift-sharing are not carried at all.** Making them safe
needs identity verification and reputation records that `identity.md` forbids this
system to build, so declining is the honest answer rather than a gap to fill.

## Getting started

```bash
npm install
cp .env.example .env.local
psql "$DATABASE_URL" -f supabase/migrations/0001_zones.sql
psql "$DATABASE_URL" -f supabase/seed.sql
npm run dev
```

```bash
npm run typecheck
npm test          # schema invariants and listing-content rules
npm run build
```

Stripe webhooks locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
The webhook is excluded from the middleware matcher because it is authenticated
by its signature and its raw body must not be touched.

## Layout

```
src/
  app/
    (public)/          catalogue, co-op listings, the exchange
    setup/             age gate, notice, consent, completion
    portal/            seats and licence keys
    api/webhooks/      the processor callback that grants consent
  lib/
    consent/           the notice text, its hash, and every consent-record write
    billing/           Stripe, and the funding check §3 requires
    exchange/          listing rules and actions
    db.ts              direct Postgres, for the consent schema only
supabase/
  migrations/0001_zones.sql
tests/                 the invariants that keep the prohibitions structural
```

## Things a reader will want to know

**Why direct Postgres alongside Supabase.** The consent record lives in a
`consent` schema that Supabase does not expose through PostgREST, so no client
holding any token can reach it. Exposing it to make the SDK usable there would
undo the separation the schema exists to create.

**Why the licence token is minted from the portal, not the webhook.** A token
minted in a webhook is a secret coming into existence with nobody present to
receive it, and the only places left to put it are the database in plaintext or
the processor's metadata. The parent mints it from their own session; only the
hash is kept, and re-issuing rotates it.

**Why the funding type is not stored.** §3 needs it to decide whether the
instrument establishes a parent, and §4's retained list is exhaustive. It is used
and discarded.

**Row types must stay `type` aliases, not `interface`.** An interface has no
implicit index signature, so it fails supabase-js's `GenericSchema` constraint and
silently degrades every query in the codebase to `never`.

## Not done

- **Decision 61 is unanswered**, and it governs where the zone boundary falls. The
  current shape assumes a per-seat licence, which makes consent-per-child fall out
  naturally and sidesteps the flat-licence awkwardness in `parental-consent.md` §6.
- **`listings.posted_by_account` lets the operator resolve a listing to an
  account.** It is needed to act on a report and is never exposed, but it is in
  tension with verdict 2 and `docs/portal.md` §12 leaves the trade to the owner.
- **The co-op director experience** is a role and a policy, with no screens yet.
- **Consent withdrawal** (`parental-consent.md` §5) has a function and no route.
- **Moderator screens** for the report queue.
