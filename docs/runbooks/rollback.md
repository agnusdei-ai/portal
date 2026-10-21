# Runbook: rollback

Use this when a deploy breaks the site or a release gate turns out to have been wrong.

## Application

1. In Render, redeploy the last good deploy. Record both commit identifiers in a ticket.
2. Confirm `/health` reports the old commit.
3. Check sign-in, the portal home, a listing page, and the consent page.

This is safe only if the old build works against the current database schema. Migrations only move
forward, so check the next section first.

## Database

Migrations are forward-only. Never edit or delete an applied migration.

- **If the bad deploy added a migration that the old build tolerates** (a new table or a new nullable
  column): roll back the application only, and leave the schema.
- **If the old build cannot run on the new schema:** fix forward. Write a new migration that undoes
  the change, test it locally with `npm test`, and deploy it with the fix.
- **Restoring a database backup is an owner decision.** A restore brings back deleted listings and
  replies, which breaks the retention promise, and loses every consent record written since the
  backup.

## Afterward

1. Find why the gate passed. Add the test that would have failed.
2. Record the incident in the ticket.
