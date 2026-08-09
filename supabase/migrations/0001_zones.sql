-- Agnus Dei parent portal — schema.
--
-- Normative source: locuto docs/portal.md. Where this file and that document
-- disagree, that document governs and this file is wrong.
--
-- Three zones, per docs/portal.md §4:
--
--   public  — organisations and products. Unauthenticated, indexable.
--   portal  — the account, the licence, billing, and the consent record.
--   (household) — children, the child-to-curriculum join, tutoring config.
--                 Absent from this schema by construction. See §5.
--
-- What is deliberately NOT here, and must never be added:
--
--   * a students table
--   * a student_curricula join, or any column able to express "this child
--     studies this curriculum"
--   * a co-op membership roster
--   * any delivery identifier, in any table, joinable to anything
--
-- docs/portal.md §5 and compliance/parental-consent.md §4 require that the
-- separation be structural rather than procedural: the schema must provide no
-- column in which the forbidden join could be written. A policy is not enough,
-- because the next engineer does not read the policy and the schema is what
-- survives. tests/schema-invariants.test.ts asserts this and fails CI if it
-- stops being true.

create extension if not exists "pgcrypto";

-- ===========================================================================
-- ZONE: portal. Separated into its own Postgres schema.
-- ===========================================================================
--
-- Supabase exposes only `public` through PostgREST. Placing the consent record
-- in its own schema means it is unreachable from any client, with or without a
-- token, and is touched only by server-side code holding the service role.
-- That is the structural half of parental-consent.md §4's separation
-- requirement; the rest is the absence of a joinable column.

create schema if not exists consent;
revoke all on schema consent from public;
revoke all on schema consent from anon, authenticated;

-- ===========================================================================
-- enums
-- ===========================================================================

create type consent_method as enum (
  'payment_card',       -- parental-consent.md §3, the specified method
  'fallback_pending'    -- §3's prepaid/youth-card case, awaiting another method
);

create type consent_state as enum (
  'notice_acknowledged', -- §2 step 4 complete, consent not yet obtained
  'granted',             -- §2 step 5 complete; a seat may now be issued
  'refused',             -- the instrument did not establish a parent
  'withdrawn'            -- parental-consent.md §5
);

create type seat_state as enum ('active', 'revoked');

create type portal_role as enum (
  'account_owner',  -- holds the licence; implied by accounts.owner_user_id
  'coop_director',  -- may edit one co-op listing. Confers no roster access
  'moderator'       -- may act on listing reports. Confers no poster identity
);

create type listing_category as enum (
  'materials',       -- books, kits, equipment offered, sought or traded
  'coop_opening',    -- a co-operative listing itself, as an institution
  'class_offering',  -- a class run by an identified organisation
  'announcement'     -- park days, fairs, curriculum sales
);
-- Deliberately absent, per docs/portal.md §8: any category brokering an adult's
-- access to a child, meaning private tutoring in person, childcare, transport
-- sharing or supervision. The mechanisms that would make those safe are the ones
-- identity.md forbids this system to build, so the honest answer is to decline.

create type listing_state as enum ('active', 'expired', 'withdrawn', 'removed');

create type bede_support as enum ('native', 'assisted', 'unsupported');

-- ===========================================================================
-- ZONE: portal — accounts, licences, roles
-- ===========================================================================

-- A household account. Comes into existence only at the §3 transaction:
-- docs/portal.md §3 forbids any family-keyed object before consent, because
-- creating one would be collection before consent and no later consent cures it.
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users (id) on delete restrict,
  -- Coarse, and only what recordkeeping actually needs. No street address:
  -- address binding is identity.md §4's business and is not established here.
  state_code text check (char_length(state_code) = 2),
  created_at timestamptz not null default now()
);

-- A seat is one child's licence. It carries no attribute of the child: the name
-- lives in the consent record, in the consent schema, because that is where
-- parental-consent.md §4 puts it and there is no second reason to hold it.
create table public.seats (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  state seat_state not null default 'active',
  -- Null until the parent asks for it from an authenticated session. Minting it
  -- in the payment webhook would mean a secret existing where no one is looking
  -- at it, and the only places to put it then are this table in plaintext or the
  -- processor's metadata, which is a third party. Minted on request, shown once,
  -- and retained only as a hash: the portal cannot replay it and a disclosure of
  -- this database does not yield a usable licence. Re-issuing rotates it.
  licence_token_sha256 bytea unique,
  licence_issued_at timestamptz,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index seats_account_idx on public.seats (account_id);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role portal_role not null,
  -- Scope for coop_director. Null for account-wide roles.
  coop_listing_id uuid,
  granted_at timestamptz not null default now(),
  primary key (user_id, role, coop_listing_id)
);

-- ===========================================================================
-- ZONE: portal — the consent record (separate schema)
-- ===========================================================================

-- The direct notice, versioned. parental-consent.md §4 retains the version and
-- hash rather than the text, so that what the parent was actually shown can be
-- established later even after the current notice has changed.
create table consent.notice_versions (
  version text primary key,
  sha256 bytea not null,
  published_at timestamptz not null default now()
);

-- Exactly the five retained items in parental-consent.md §4, and nothing else.
--
-- NOT retained, and no column exists for any of them: the card number, expiry,
-- security code, cardholder address, or any portion of the card beyond what the
-- processor's reference implies. Card data is handled by the processor and never
-- reaches these systems.
create table consent.consent_records (
  id uuid primary key default gen_random_uuid(),

  -- The parent, who is an adult with their own sign-in. Held here rather than
  -- passed through the processor, so that the only thing the processor holds
  -- about this ceremony is an opaque record id.
  owner_user_id uuid not null references auth.users (id) on delete restrict,

  -- Null until consent is granted, and this ordering is forced.
  --
  -- parental-consent.md §2 puts the notice and its acknowledgement *before* the
  -- consent step, so this record necessarily precedes the transaction. But
  -- docs/portal.md §3 forbids any family-keyed object before the transaction,
  -- and the account is exactly that. Both hold only if the consent record is
  -- not itself a family object: it is the evidence that consent was obtained,
  -- mandated by §4, and the account it authorises is created at the moment the
  -- charge succeeds and not before.
  account_id uuid references public.accounts (id) on delete restrict,

  -- §4: "The version identifier and hash of the direct notice presented"
  notice_version text not null references consent.notice_versions (version),

  -- §4: "The time the notice was acknowledged and the time consent completed",
  -- which together establish the ordering §2 requires.
  notice_acknowledged_at timestamptz not null,
  consent_completed_at timestamptz,

  -- §4: "The payment processor's transaction reference". A reference held by the
  -- processor, not card data held here.
  processor_reference text,

  -- §4: "The name given for the child account during setup". docs/portal.md §5
  -- records this as the sole permitted child-keyed datum in the hosted zone. It
  -- is evidence that consent was obtained. It is not an educational record, and
  -- no further attribute of the child may be hung upon it.
  child_account_name text not null,

  -- §4: "The method used, where more than one is available"
  method consent_method not null default 'payment_card',
  state consent_state not null default 'notice_acknowledged',

  -- §3: a card issued to the child is not evidence of a parent. Recorded so the
  -- refusal is auditable, since the fallback is a compliance event.
  refusal_reason text,

  seat_id uuid references public.seats (id) on delete set null,
  created_at timestamptz not null default now(),

  -- Ordering is the point of the two timestamps, so the database enforces it
  -- rather than trusting the application to have got §2 right.
  constraint consent_follows_notice check (
    consent_completed_at is null
    or consent_completed_at >= notice_acknowledged_at
  ),
  -- A granted record without a transaction reference would be a consent we
  -- cannot evidence, which is the same as no consent at all.
  constraint granted_is_evidenced check (
    state <> 'granted'
    or (
      processor_reference is not null
      and consent_completed_at is not null
      and account_id is not null
      and seat_id is not null
    )
  )
);

create index consent_records_account_idx on consent.consent_records (account_id);
create unique index consent_records_processor_ref_idx
  on consent.consent_records (processor_reference)
  where processor_reference is not null;

-- ===========================================================================
-- ZONE: public — catalogue and aggregation
-- ===========================================================================

create table public.curricula (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  publisher text not null,
  subject text not null,
  grade_min text,
  grade_max text,
  philosophy text,
  description text,
  -- Set from published sources only. docs/portal.md §9: never populated from
  -- what families are observed to use, which would be the §5 join aggregated
  -- and laundered back into the public zone.
  bede_support bede_support not null default 'assisted',
  created_at timestamptz not null default now()
);

create index curricula_subject_idx on public.curricula (subject);

create table public.resource_links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null unique,
  subject text,
  description text,
  created_at timestamptz not null default now()
);

-- ===========================================================================
-- ZONE: public — the exchange
-- ===========================================================================

-- A co-operative listing. The institution is the subject, per verdict 2.
--
-- There is no membership table anywhere in this schema. docs/portal.md §10:
-- a roster is an enumeration of people, and membership is established by the
-- ordinary groups.md group ceremony, about which the operator learns nothing.
create table public.coop_listings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  state_code text check (char_length(state_code) = 2),
  -- Metropolitan area or county. docs/portal.md §7: never a point location.
  region text,
  description text,
  meeting_day text,
  -- An opaque reference so an enquiry can say which co-operative it concerns.
  -- docs/portal.md §10: it is not an authenticator, because identity.md §5.1
  -- records that an invitation cannot authenticate and a code on a public board
  -- is available to everyone who reads the board. It admits no one to anything.
  enquiry_ref text not null unique,
  is_listed boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  category listing_category not null,
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 10 and 4000),
  -- Coarse geography only, per docs/portal.md §7. The meeting place for an
  -- in-person exchange is negotiated over the reply relay and never published.
  state_code text not null check (char_length(state_code) = 2),
  region text not null,

  -- Internal only, and never exposed by any policy below. Needed for regional
  -- rate limiting and for acting on a report, which docs/portal.md §12 records
  -- as the whole of the available moderation toolkit.
  --
  -- OPEN, per docs/portal.md §12: this column means the operator can resolve a
  -- listing to an account. That is in tension with the spirit of verdict 2, and
  -- the alternative (a rotating salted pseudonym that breaks cross-epoch
  -- correlation) costs the ability to act on a repeat offender. The owner
  -- decides; this is the conservative-for-moderation option, not the
  -- conservative-for-privacy one.
  posted_by_account uuid not null references public.accounts (id) on delete cascade,

  state listing_state not null default 'active',
  -- Short by design. docs/portal.md §7 treats expiry as a safety mechanism
  -- rather than housekeeping: a corpus retained for years permits patterns about
  -- individual households to be reconstructed even with every prohibited field
  -- absent.
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

create index listings_browse_idx
  on public.listings (state_code, category, created_at desc)
  where state = 'active';
create index listings_author_idx on public.listings (posted_by_account);

-- A reply is delivered inside the portal, not to an email address and never
-- into Locuto. docs/portal.md §6: replying creates no Locuto contact, consumes
-- no delivery identifier, and discloses no account identifier or fingerprint to
-- either party. Two adults negotiate here and, if they later wish to connect
-- their households, they scan a code in person like anyone else.
create table public.listing_replies (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  from_account uuid not null references public.accounts (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index listing_replies_listing_idx
  on public.listing_replies (listing_id, created_at);
create index listing_replies_from_idx on public.listing_replies (from_account);

create table public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  reported_by uuid references public.accounts (id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 500),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index listing_reports_open_idx
  on public.listing_reports (created_at desc)
  where resolved_at is null;

-- ===========================================================================
-- helpers
-- ===========================================================================

create or replace function public.current_account_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.accounts where owner_user_id = auth.uid();
$$;

create or replace function public.has_role(target portal_role)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = target
  );
$$;

create or replace function public.directs_coop(target_coop uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role = 'coop_director'
      and coop_listing_id = target_coop
  );
$$;

-- ===========================================================================
-- RLS
-- ===========================================================================

alter table public.accounts        enable row level security;
alter table public.seats           enable row level security;
alter table public.user_roles      enable row level security;
alter table public.curricula       enable row level security;
alter table public.resource_links  enable row level security;
alter table public.coop_listings   enable row level security;
alter table public.listings        enable row level security;
alter table public.listing_replies enable row level security;
alter table public.listing_reports enable row level security;

-- Public zone: readable by anyone, including logged-out visitors. Writes to the
-- catalogue go through the service role only.
create policy "catalogue is public" on public.curricula
  for select using (true);
create policy "resources are public" on public.resource_links
  for select using (true);
create policy "listed co-ops are public" on public.coop_listings
  for select using (is_listed);
create policy "directors edit their co-op" on public.coop_listings
  for update using (directs_coop(id)) with check (directs_coop(id));

-- Anyone may browse the exchange. Only a household that completed the §3
-- transaction may post, which is what makes the exchange adult-to-adult in
-- docs/portal.md §6's sense: an account exists only behind a card transaction.
create policy "active listings are public" on public.listings
  for select using (state = 'active' and expires_at > now());
create policy "account holders post" on public.listings
  for insert with check (posted_by_account = current_account_id());
create policy "authors manage their listings" on public.listings
  for update using (posted_by_account = current_account_id())
  with check (posted_by_account = current_account_id());
create policy "moderators see all listings" on public.listings
  for select using (has_role('moderator'));
create policy "moderators act on listings" on public.listings
  for update using (has_role('moderator'));

-- A reply is visible to its sender and to the listing's author, and to nobody
-- else. There is no thread anyone can browse.
create policy "reply visible to the two parties" on public.listing_replies
  for select using (
    from_account = current_account_id()
    or exists (
      select 1 from public.listings l
      where l.id = listing_id and l.posted_by_account = current_account_id()
    )
  );
create policy "account holders reply" on public.listing_replies
  for insert with check (from_account = current_account_id());

create policy "report a listing" on public.listing_reports
  for insert with check (
    reported_by = current_account_id() or reported_by is null
  );
create policy "moderators read reports" on public.listing_reports
  for select using (has_role('moderator'));
create policy "moderators resolve reports" on public.listing_reports
  for update using (has_role('moderator'));

-- Portal zone.
create policy "read own account" on public.accounts
  for select using (owner_user_id = auth.uid());
create policy "read own seats" on public.seats
  for select using (account_id = current_account_id());
create policy "read own roles" on public.user_roles
  for select using (user_id = auth.uid());

-- Accounts and seats are created by the webhook under the service role, after
-- the processor confirms the charge. There is deliberately no client-side insert
-- policy on either: a client able to mint its own account or seat would be a
-- client able to obtain a licence without the transaction that constitutes
-- consent.
