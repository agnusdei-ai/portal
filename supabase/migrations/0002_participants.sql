-- Participants, permitted communication axes, the communication waiver, and the
-- fraud controls that follow from carrying commerce between strangers.
--
-- Normative source: locuto docs/portal.md §6a, §7a and §13.
--
-- The governing rule, and the reason most of this file exists: the platform
-- carries adult-to-adult communication only. No child is a participant in any
-- role, on any axis, ever. There is no child account in this schema to be one
-- with, and the axes below are closed rather than open, so a new participant
-- class cannot be introduced by configuration.

-- ===========================================================================
-- participants
-- ===========================================================================

create type participant_class as enum (
  'parent',   -- a household account holder
  'teacher',  -- an adult offering instruction, vouched for by a co-operative
  'guide',    -- an adult leading classes, vouched for by a co-operative
  'coop'      -- a co-operative acting institutionally, through its director
);

-- An account may hold more than one class: a parent who also guides is ordinary
-- in this audience, and forcing a choice would push them into a second account.
create table public.account_participants (
  account_id uuid not null references public.accounts (id) on delete cascade,
  class participant_class not null,
  granted_at timestamptz not null default now(),
  primary key (account_id, class)
);

-- The vouch. docs/portal.md §6a: a teacher or guide is reachable only through an
-- identified co-operative that vouches for them, which puts the trust decision
-- with the institution that already makes it rather than building the identity
-- apparatus identity.md forbids.
--
-- This is NOT the roster §10 prohibits, and the difference is load-bearing. A
-- roster enumerates the member families of a co-operative, which is an
-- enumeration of private people including children. A vouch names an adult
-- acting in a public professional capacity for an institution that chose to be
-- named. One is a directory of households; the other is a staff list.
create table public.coop_affiliations (
  coop_listing_id uuid not null references public.coop_listings (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  class participant_class not null check (class in ('teacher', 'guide')),
  vouched_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (coop_listing_id, account_id, class)
);

create index coop_affiliations_account_idx on public.coop_affiliations (account_id);

-- ===========================================================================
-- permitted axes
-- ===========================================================================

-- The closed set of who may communicate with whom. Held as data so it can be
-- audited in one query, and constrained so it cannot quietly grow: every row is
-- a deliberate act, and there is no row anywhere that includes a child because
-- there is no participant class for one.
create table public.permitted_axes (
  a participant_class not null,
  b participant_class not null,
  note text not null,
  primary key (a, b)
);

-- Inserted in both orders, so a lookup never has to normalise the pair.
insert into public.permitted_axes (a, b, note) values
  ('parent',  'parent',  'Households trading materials and information directly.'),
  ('parent',  'teacher', 'A parent and an educator, about instruction.'),
  ('teacher', 'parent',  'A parent and an educator, about instruction.'),
  ('guide',   'coop',    'A guide and a co-operative, about leading classes.'),
  ('coop',    'guide',   'A guide and a co-operative, about leading classes.');

-- ===========================================================================
-- the communication waiver
-- ===========================================================================

-- Distinct from the parental consent in the `consent` schema, and it must not be
-- confused with it. That one is a parent consenting to collection from their
-- child, under COPPA, evidenced by a card transaction. This one is an adult
-- opting in to communicate with other adults here, and its central disclosure is
-- that these messages are not the end-to-end encrypted channel Locuto sells:
-- the operator can read them, and must be able to, because fraud regulation
-- requires an operator that can investigate what happened on its own service.
--
-- A parent who has accepted it may communicate freely, without a further gate
-- per listing or per message.
create table public.communication_waivers (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  version text not null,
  sha256 bytea not null,
  accepted_at timestamptz not null default now(),
  withdrawn_at timestamptz
);

-- ===========================================================================
-- axis enforcement on listings and replies
-- ===========================================================================

alter table public.listings
  add column posted_as participant_class not null default 'parent';

alter table public.listings
  alter column posted_as drop default;

create or replace function public.holds_class(target_account uuid, target_class participant_class)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.account_participants
    where account_id = target_account and class = target_class
  );
$$;

/*
 * Every reply is checked against the closed axis table before it is written.
 *
 * In a trigger rather than in the application, because docs/portal.md's
 * prohibitions are structural claims: an application check is a claim about the
 * code that happens to be deployed, and a trigger is a claim about the database.
 */
create or replace function public.enforce_reply_axis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_class participant_class;
  ok boolean;
begin
  select posted_as into listing_class from public.listings where id = new.listing_id;

  if listing_class is null then
    raise exception 'listing % does not exist', new.listing_id;
  end if;

  -- The replier must hold some class that pairs with the listing's class.
  select exists (
    select 1
    from public.account_participants ap
    join public.permitted_axes ax
      on ax.a = listing_class and ax.b = ap.class
    where ap.account_id = new.from_account
  ) into ok;

  if not ok then
    raise exception
      'no permitted communication axis between this listing and the replying account';
  end if;

  -- An unwithdrawn waiver is required to communicate at all.
  if not exists (
    select 1 from public.communication_waivers
    where account_id = new.from_account and withdrawn_at is null
  ) then
    raise exception 'the communication waiver has not been accepted';
  end if;

  return new;
end;
$$;

create trigger listing_replies_axis
  before insert on public.listing_replies
  for each row execute function public.enforce_reply_axis();

/*
 * A listing may only be posted in a class the account actually holds, and
 * teacher and guide are held only by way of an active vouch.
 */
create or replace function public.enforce_listing_class()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.holds_class(new.posted_by_account, new.posted_as) then
    raise exception 'this account does not hold the participant class %', new.posted_as;
  end if;

  if new.posted_as in ('teacher', 'guide') and not exists (
    select 1 from public.coop_affiliations
    where account_id = new.posted_by_account
      and class = new.posted_as
      and revoked_at is null
  ) then
    raise exception
      'a teacher or guide is reachable only through a co-operative that vouches for them';
  end if;

  if not exists (
    select 1 from public.communication_waivers
    where account_id = new.posted_by_account and withdrawn_at is null
  ) then
    raise exception 'the communication waiver has not been accepted';
  end if;

  return new;
end;
$$;

create trigger listings_class
  before insert on public.listings
  for each row execute function public.enforce_listing_class();

-- ===========================================================================
-- fraud
-- ===========================================================================

-- docs/portal.md §13. Carrying commerce between strangers brings obligations
-- that pull against non-enumerability, and the pull is resolved in favour of
-- being able to investigate: an operator that cannot say what happened on its
-- own service cannot answer a regulator, a card network, or a defrauded family.
--
-- What this does NOT license is a public directory. `listings.posted_by_account`
-- stays invisible to every reader; it exists so a report can be acted on.

alter type consent_state add value if not exists 'disputed';

alter table public.seats
  add column suspended_at timestamptz,
  add column suspension_reason text;

-- A chargeback on the §3 transaction is not an ordinary billing event. That
-- charge *is* the parental consent, and the cardholder's notification of it is
-- what verified the consent, so a dispute puts the evidence itself in question.
-- The seat is suspended rather than deleted, because the record of what happened
-- is exactly what a fraud investigation needs.
create table public.payment_disputes (
  id uuid primary key default gen_random_uuid(),
  seat_id uuid references public.seats (id) on delete set null,
  processor_reference text not null unique,
  kind text not null check (kind in ('dispute', 'refund')),
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  outcome text
);

-- Rate limiting is the other half of moderation-without-identity. Counted per
-- account per day rather than per address, since an address is not something
-- this design holds.
create or replace function public.listings_today(target_account uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::int
  from public.listings
  where posted_by_account = target_account
    and created_at > now() - interval '24 hours';
$$;

-- ===========================================================================
-- RLS
-- ===========================================================================

alter table public.account_participants   enable row level security;
alter table public.coop_affiliations      enable row level security;
alter table public.permitted_axes         enable row level security;
alter table public.communication_waivers  enable row level security;
alter table public.payment_disputes       enable row level security;

create policy "read own classes" on public.account_participants
  for select using (account_id = current_account_id());

-- A vouch is public in the sense that the co-operative stands behind it, which
-- is what makes it useful as accountability. It names an adult acting for a
-- named institution, and no household or child is reachable through it.
create policy "vouches are public" on public.coop_affiliations
  for select using (revoked_at is null);
create policy "directors vouch" on public.coop_affiliations
  for all using (directs_coop(coop_listing_id))
  with check (directs_coop(coop_listing_id));

create policy "axes are public" on public.permitted_axes
  for select using (true);

create policy "read own waiver" on public.communication_waivers
  for select using (account_id = current_account_id());
create policy "accept own waiver" on public.communication_waivers
  for insert with check (account_id = current_account_id());
create policy "withdraw own waiver" on public.communication_waivers
  for update using (account_id = current_account_id())
  with check (account_id = current_account_id());

create policy "moderators read disputes" on public.payment_disputes
  for select using (has_role('moderator'));
