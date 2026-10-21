-- What a paying account bought, as the signed contract states it (amendment 2
-- §5). The portal holds references to prices and minimums, never amounts.

create type plan_kind as enum ('family', 'coop', 'school_eval', 'per_learner', 'campus');
create type billing_unit as enum ('household', 'family', 'learner', 'campus');
create type entitlement_status as enum ('active', 'suspended', 'ended');

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete restrict,
  contract_id text not null,
  plan_kind plan_kind not null,
  billing_unit billing_unit not null,
  -- Null is unlimited enrolled seats. It is not a promise of simultaneous
  -- capacity, which is qualified per appliance workload.
  seat_cap integer check (seat_cap > 0),
  minimum_monthly text,
  term_start date not null,
  term_end date check (term_end > term_start),
  price_ref text not null,
  status entitlement_status not null default 'active',
  allow_faith_content boolean not null,
  created_at timestamptz not null default now()
);

create unique index entitlements_one_active_idx
  on public.entitlements (account_id) where status = 'active';

-- Faith content is on by default for family and co-op plans and off for
-- school plans unless the contract allows it (DECISIONS.md).
create function public.entitlement_defaults() returns trigger
language plpgsql as $$
begin
  new.allow_faith_content := coalesce(new.allow_faith_content, new.plan_kind in ('family', 'coop'));
  return new;
end
$$;

create trigger entitlement_defaults before insert on public.entitlements
  for each row execute function public.entitlement_defaults();

-- A plan change is a recorded amendment: a new row, with the old one ended.
-- Only status and the end date move in place.
create function public.entitlement_terms_fixed() returns trigger
language plpgsql as $$
begin
  if (new.account_id, new.contract_id, new.plan_kind, new.billing_unit, new.seat_cap,
      new.minimum_monthly, new.term_start, new.price_ref, new.allow_faith_content)
     is distinct from
     (old.account_id, old.contract_id, old.plan_kind, old.billing_unit, old.seat_cap,
      old.minimum_monthly, old.term_start, old.price_ref, old.allow_faith_content) then
    raise exception 'entitlement terms are fixed; record an amendment as a new entitlement';
  end if;
  return new;
end
$$;

create trigger entitlement_terms_fixed before update on public.entitlements
  for each row execute function public.entitlement_terms_fixed();

alter table public.entitlements enable row level security;

-- Written only by the service role from a signed contract; read by the owner.
create policy "owner reads own entitlements" on public.entitlements
  for select using (account_id = current_account_id());
