-- Abuse detection records: the operator-readable trace of blocked actions and
-- terminated sessions.
--
-- Normative source: the "Abuse controls" section of the portal spec
-- (art_ztdch8TP), and locuto docs/portal.md §12, which requires that
-- communications remain operator-readable for safety review. The response
-- ladder — block the action, escalate with repetition, terminate the session —
-- ends here, in a record the operator can act on.
--
-- What this table deliberately does NOT hold, enforced by the invariant tests:
--
--   * no IP address, remote address, or forwarded-for column. The record is
--     account-scoped; an anonymous caller is recorded as a null account, not
--     as an address.
--   * no request body or payload copy. The offending text, where there is
--     one, is visible in the blocked exchange content itself.
--
-- `detail` carries only threshold and bucket metadata: which limit tripped,
-- and how many events fell inside the window.

create table if not exists public.abuse_events (
  id uuid primary key default gen_random_uuid(),
  -- Null for anonymous traffic — an unauthenticated caller hammering a public
  -- edge. The event is still recorded, with no one attached to it.
  account_id uuid references public.accounts (id) on delete set null,
  kind text not null check (kind in ('crypto_solicitation', 'rate_limit', 'automated_traffic')),
  action text not null check (action in ('blocked', 'session_terminated')),
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index abuse_events_recent_idx on public.abuse_events (created_at desc);

alter table public.abuse_events enable row level security;

-- Deliberately narrow. No client writes an abuse event — they are written by
-- the server-side detection paths under the service role — and the only client
-- read is the one the spec names: the exchange's existing dispute and moderator
-- surfaces can read these events; nothing else can.
create policy "moderators read abuse events" on public.abuse_events
  for select using (has_role('moderator'));
