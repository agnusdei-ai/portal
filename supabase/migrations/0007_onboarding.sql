-- The persona onboarding checklist (spec art_ztdch8TP, "Personas and guided
-- onboarding"): one checklist per account, persona-aware, persisted so steps
-- survive sign-out. It stores a persona choice and the ids of steps the
-- account marked done themselves — nothing else. Steps that correspond to
-- system facts (the consent transaction, the verification attestation, a
-- co-operative vouch, exchange participation) are derived at read time from
-- their own tables, never from a mark here.

create table public.onboarding_checklists (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  persona text not null default 'parent' check (persona in ('parent', 'educator', 'guide')),
  marked_steps text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.onboarding_checklists enable row level security;

create policy "account manages own checklist"
  on public.onboarding_checklists
  for all
  using (
    account_id in (select id from accounts where owner_user_id = auth.uid())
  )
  with check (
    account_id in (select id from accounts where owner_user_id = auth.uid())
  );
