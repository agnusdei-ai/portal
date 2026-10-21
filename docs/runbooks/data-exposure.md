# Runbook: data exposure

Use this when member data may have reached someone it should not: a leaked key, a policy bug, a
misdirected export, or a report from outside.

The sensitive data here is small but serious: seat labels and consent records in the consent
schema, Exchange listing and reply text, account emails in Supabase Auth, and identity attestation
state. Card data never reaches these systems.

## First hour

1. Open an incident ticket and name one incident lead. Note the time you learned of it.
2. Contain without destroying evidence:
   - Rotate any key that may be involved ([key-rotation.md](key-rotation.md)).
   - If a policy or route is leaking, take the route down or deploy the fix. Do not edit rows by
     hand.
   - Revoke sessions if accounts may be taken over. Rotating the JWT secret ends all sessions.
3. Preserve evidence. Export the relevant Supabase, Render, and Cloudflare logs to storage the
   operator controls. Grafana's free tier keeps only 14 days.
4. Tell the owner.

## Scope it

Answer these in the ticket, with the evidence for each:

- Which tables, columns, or routes were reachable, and by whom?
- From when to when?
- How many accounts are affected?
- Were seat labels, consent records, or reply text involved?
- Did an operator read replies? Check `public.operator_reads`.
- Did abuse controls fire? Check `public.abuse_events`.

## Notify

Counsel decides whether and whom to notify, and by when. Inputs counsel will ask for:

- the scope answers above;
- whether the data concerns children's accounts, since consent records are COPPA evidence;
- the states where affected members live, which accounts record as a two-letter code.

Do not tell members or anyone outside the company before counsel agrees the wording.

## Close

1. Fix the cause with a test that fails on the old behavior.
2. Record what happened, the timeline, and what changed. Keep it with the ticket.
