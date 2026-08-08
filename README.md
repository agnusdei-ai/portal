# Agnus Dei — parent portal

The portal parents use to onboard **Bede** with the curriculum they already own.

## The split this codebase encodes

The directory is free and public; the **binding** is what's paid for.

| | Where | Auth | Why |
|---|---|---|---|
| Co-op and curriculum directory | `/curriculum`, `/coops` | none | Commodity data. Gating it would trade away SEO and word-of-mouth for revenue it was never going to earn. |
| Curriculum → student → Bede binding | `/onboarding/*` | required | Proprietary, high-effort, and not reproducible with a search engine. This is the product. |
| Planning, records, compliance | `/dashboard` | required | The recurring value that keeps the subscription alive. |

Parents don't pay to *find* curriculum — most chose theirs years ago. They pay for
the thing that turns a shelf of books into a working school year. So the gate sits
on **activation**, not on browsing.

Co-ops are distribution, not just rows in a table: a director who onboards thirty
families outweighs thirty cold signups. That's why `coops` is a tenancy root of its
own rather than a field on `families`.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres + auth + RLS)

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in your Supabase project values
npm run dev
```

Apply the schema and seed the catalog:

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/seed.sql
```

Auth is passwordless email links. Set your Supabase project's redirect URL to
`{SITE_URL}/auth/callback`.

## Layout

```
src/
  app/
    (public)/            free directory — no account, indexed
    login/               passwordless email link
    auth/callback/       session exchange
    onboarding/          the wizard (family → students → curriculum → co-op → review)
    dashboard/           post-setup home
  lib/
    onboarding/
      steps.ts           step order, resume, and deep-link guards
      schema.ts          Zod validation shared by every step
      actions.ts         server actions — the only place that writes
      queries.ts         server-side reads
    bede/handoff.ts      the payload contract between the portal and Bede
    supabase/            browser, server, and service-role clients
supabase/
  migrations/0001_init.sql
  seed.sql
```

## The onboarding wizard

Five steps, with progress recorded on `families.onboarding_step`:

1. **Family** — name and state. State drives which recordkeeping output Bede generates.
2. **Students** — Bede plans per child.
3. **Curriculum** — the binding. Catalog picks *or* free text, because plenty of
   real curriculum will never be in the catalog and refusing it would strand
   parents at the most important step.
4. **Co-op** *(optional)* — join by code; shared courses adopt the co-op's pacing.
5. **Review** — shows the exact payload, then hands it to Bede.

Progress only ever moves forward, so revisiting step 2 after reaching step 4 doesn't
cost a parent their place. `guardStep()` bounces anyone who deep-links past where
they actually are.

The final step is transactional in spirit: onboarding is marked complete **only if
Bede accepts the payload**. A failed handoff leaves the family on `/review` with a
retryable error rather than a portal that looks provisioned but isn't.

## Bede handoff

`buildHandoffPayload()` produces the versioned contract in `src/lib/bede/handoff.ts`,
POSTed to `${BEDE_API_URL}/v1/provision`. Every attempt is recorded in
`bede_handoffs` with its payload and outcome.

With `BEDE_API_URL` unset the payload is still recorded and treated as a success, so
onboarding is testable end to end before Bede's provisioning endpoint exists.

## Notes for whoever picks this up

- `src/lib/types.ts` is hand-written. Replace it with
  `npx supabase gen types typescript --linked` once the project is linked. Row types
  must stay `type` aliases, not `interface` — interfaces have no implicit index
  signature and silently fail supabase-js's `GenericSchema` constraint, which
  degrades every query to `never`.
- Billing is not wired up. The gate is structural (routes and RLS), not yet
  enforced by a subscription check.
- The co-op **director** experience doesn't exist yet — co-ops and their course
  lists are seeded directly. `coop_role` and `is_listed` are in the schema ready
  for it.
