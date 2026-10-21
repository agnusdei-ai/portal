# Runbook: key rotation

Rotate a key on schedule, when a person with access leaves, or at once if a key may have leaked.
A suspected leak is also a data exposure: run [data-exposure.md](data-exposure.md) alongside this.

## Keys this service holds

| Key | Where it lives | What it grants |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Render environment group | Bypasses RLS on the public schema |
| Supabase JWT secret | Supabase project settings | Signs every session; rotating it signs everyone out |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Render build argument | Public by design; rotate with the JWT secret |
| `DATABASE_URL` password | Render environment group | Direct Postgres, including the consent schema |
| `STRIPE_SECRET_KEY` | Render environment group | Charges, refunds, Prices |
| `STRIPE_WEBHOOK_SECRET` | Render environment group | Verifies payment webhooks |
| `SOCURE_API_KEY`, `SOCURE_WEBHOOK_SECRET` | Render environment group | Identity evaluations and their webhooks |

## Steps

1. Open a ticket. Record which key, why, and who is rotating it. Never paste a key into the ticket.
2. Create the new key at the issuer: Supabase, Stripe, or Socure. Keep the old key active for now
   where the issuer allows two.
3. Put the new value in the Render environment group. Change `NEXT_PUBLIC_*` values as build
   arguments, which needs a rebuild, not a restart.
4. Deploy. Confirm `/health` reports the new commit.
5. Check the path the key serves:
   - Service role or database: sign in, open the portal home, and open the consent page.
   - Stripe secret: load the consent page, which reads the seat Price.
   - A webhook secret: send a test event from the vendor dashboard and confirm a 200 response.
6. Revoke the old key at the issuer.
7. Close the ticket with the time the old key was revoked.

## Notes

- Rotating the JWT secret ends every session. Warn members first unless the key leaked.
- Webhook secrets have no overlap window at some vendors. Rotate them during low traffic and
  expect the vendor to retry what fails in between.
- No key belongs in the repository. The secret scan in CI refuses key-shaped strings.
