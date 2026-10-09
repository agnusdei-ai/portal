-- A parent's own collection of resources worth keeping.
--
-- Normative source: the "Federated resource discovery" section of the portal
-- spec (art_ztdch8TP). Search is an ephemeral relay — nothing about a query is
-- persisted anywhere, and the invariant tests fail if a results table ever
-- appears. The bookmark is the durable layer, and it belongs to the account
-- alone: the only rows that exist are rows a parent chose to create.

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  -- A signpost, not a rehost: the portal stores the pointer and the parent's
  -- own words about it, never a copy of the resource.
  url text not null check (url ~ '^https://'),
  title text not null,
  -- Where the hit came from — a state network, a publisher, or the provider
  -- that surfaced it. Attribution outlives the search that found it.
  source_label text,
  subject text not null default 'general',
  -- The parent's own words. No one else writes into this table.
  note text,
  created_at timestamptz not null default now(),
  unique (account_id, url)
);

create index bookmarks_account_subject_idx
  on public.bookmarks (account_id, subject, created_at desc);

alter table public.bookmarks enable row level security;

-- Full ownership by the one account: read, save, annotate, delete. RLS makes a
-- cross-account read structurally impossible, not merely unrendered.
create policy "own bookmarks only" on public.bookmarks
  for all using (account_id = current_account_id())
  with check (account_id = current_account_id());
