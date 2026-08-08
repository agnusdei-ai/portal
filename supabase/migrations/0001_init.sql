-- Agnus Dei parent portal — initial schema.
--
-- Two tenancy roots live side by side:
--   families  — the paying unit. Everything Bede is configured against hangs off a family.
--   coops     — a distribution unit. A co-op is not owned by any one family; families
--               join it, and joining pre-populates their curriculum for shared subjects.
--
-- Catalog tables (curricula, coops) are world-readable on purpose: the public directory
-- is unauthenticated and indexed. Only family-scoped rows sit behind RLS.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- enums
-- ---------------------------------------------------------------------------

create type onboarding_step as enum (
  'family',
  'students',
  'curriculum',
  'coop',
  'review',
  'complete'
);

create type family_role as enum ('owner', 'parent', 'viewer');
create type coop_role as enum ('director', 'member');
create type membership_status as enum ('pending', 'active', 'removed');
create type curriculum_source as enum ('family', 'coop');
create type handoff_status as enum ('pending', 'sent', 'failed');

-- Bede's depth of support for a given curriculum. Drives the badge in the public
-- directory and sets expectations before a parent pays.
create type bede_support as enum (
  'native',      -- scope-and-sequence ingested, Bede teaches lesson by lesson
  'assisted',    -- Bede knows the material, parent supplies the pacing
  'unsupported'  -- listed for completeness; Bede cannot yet teach against it
);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

-- Mirror new auth users into profiles so the portal never has to read auth.users.
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- families
-- ---------------------------------------------------------------------------

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references profiles (id) on delete restrict,
  -- Two-letter state code. Homeschool recordkeeping requirements are set at the
  -- state level, so this drives which compliance output Bede generates.
  state_code text check (char_length(state_code) = 2),
  school_year text,
  onboarding_step onboarding_step not null default 'family',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index families_owner_idx on families (owner_id);

create table family_members (
  family_id uuid not null references families (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role family_role not null default 'parent',
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create index family_members_user_idx on family_members (user_id);

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------

create table students (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  first_name text not null,
  -- Birth year rather than full DOB: enough to sanity-check grade placement
  -- without holding a child's date of birth.
  birth_year int check (birth_year between 1990 and 2100),
  grade_level text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index students_family_idx on students (family_id);

-- ---------------------------------------------------------------------------
-- curriculum catalog (public)
-- ---------------------------------------------------------------------------

create table curricula (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  publisher text not null,
  subject text not null,
  grade_min text,
  grade_max text,
  -- 'classical', 'charlotte-mason', 'unit-study', 'traditional', 'unschooling'
  philosophy text,
  description text,
  bede_support bede_support not null default 'assisted',
  created_at timestamptz not null default now()
);

create index curricula_subject_idx on curricula (subject);
create index curricula_publisher_idx on curricula (publisher);

-- ---------------------------------------------------------------------------
-- co-ops
-- ---------------------------------------------------------------------------

create table coops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  state_code text check (char_length(state_code) = 2),
  region text,
  description text,
  meeting_day text,
  -- Families join with this code during onboarding. Short, human-readable,
  -- and rotatable by the director.
  join_code text not null unique,
  director_id uuid references profiles (id) on delete set null,
  is_listed boolean not null default true,
  created_at timestamptz not null default now()
);

create index coops_state_idx on coops (state_code);

create table coop_memberships (
  coop_id uuid not null references coops (id) on delete cascade,
  family_id uuid not null references families (id) on delete cascade,
  role coop_role not null default 'member',
  status membership_status not null default 'active',
  created_at timestamptz not null default now(),
  primary key (coop_id, family_id)
);

create index coop_memberships_family_idx on coop_memberships (family_id);

-- Subjects the co-op teaches together. Joining a co-op offers these as
-- pre-filled curriculum choices, which is the whole point of the co-op tier.
create table coop_curricula (
  coop_id uuid not null references coops (id) on delete cascade,
  curriculum_id uuid not null references curricula (id) on delete cascade,
  grade_level text,
  primary key (coop_id, curriculum_id, grade_level)
);

-- ---------------------------------------------------------------------------
-- the binding: student <-> curriculum
-- ---------------------------------------------------------------------------

-- This table is the product. Everything upstream is data collection; this is
-- what Bede is actually configured against.
create table student_curricula (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  -- Either a catalog entry or a free-text title. Parents use plenty of material
  -- that will never be in the catalog, and refusing to record it would strand
  -- them at the most important step of onboarding.
  curriculum_id uuid references curricula (id) on delete set null,
  custom_title text,
  subject text not null,
  source curriculum_source not null default 'family',
  coop_id uuid references coops (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint curriculum_identified check (
    curriculum_id is not null or custom_title is not null
  )
);

create index student_curricula_student_idx on student_curricula (student_id);

-- ---------------------------------------------------------------------------
-- Bede handoff
-- ---------------------------------------------------------------------------

create table bede_handoffs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  status handoff_status not null default 'pending',
  payload jsonb not null,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index bede_handoffs_family_idx on bede_handoffs (family_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- Membership check used by most policies. SECURITY DEFINER so it can read
-- family_members without recursing through that table's own policy.
create function is_family_member(target_family uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from family_members
    where family_id = target_family
      and user_id = auth.uid()
  );
$$;

-- An unlisted co-op still has to be visible to the families already in it,
-- otherwise a private co-op's members lose their own schedule.
create function is_family_member_of_coop(target_coop uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from coop_memberships cm
    join family_members fm on fm.family_id = cm.family_id
    where cm.coop_id = target_coop
      and fm.user_id = auth.uid()
      and cm.status = 'active'
  );
$$;

alter table profiles            enable row level security;
alter table families            enable row level security;
alter table family_members      enable row level security;
alter table students            enable row level security;
alter table student_curricula   enable row level security;
alter table coop_memberships    enable row level security;
alter table bede_handoffs       enable row level security;

-- Catalog stays readable by anyone, including logged-out visitors browsing the
-- public directory. Writes go through the service role only.
alter table curricula     enable row level security;
alter table coops         enable row level security;
alter table coop_curricula enable row level security;

create policy "catalog is public" on curricula
  for select using (true);
create policy "listed coops are public" on coops
  for select using (is_listed or is_family_member_of_coop(id));
create policy "coop curricula are public" on coop_curricula
  for select using (true);

create policy "read own profile" on profiles
  for select using (id = auth.uid());
create policy "update own profile" on profiles
  for update using (id = auth.uid());

create policy "read own families" on families
  for select using (is_family_member(id));
create policy "create own family" on families
  for insert with check (owner_id = auth.uid());
create policy "update own family" on families
  for update using (is_family_member(id));

create policy "read own memberships" on family_members
  for select using (user_id = auth.uid() or is_family_member(family_id));
create policy "owner adds members" on family_members
  for insert with check (
    user_id = auth.uid()
    or exists (select 1 from families f where f.id = family_id and f.owner_id = auth.uid())
  );

create policy "read own students" on students
  for select using (is_family_member(family_id));
create policy "write own students" on students
  for all using (is_family_member(family_id))
  with check (is_family_member(family_id));

create policy "read own bindings" on student_curricula
  for select using (
    exists (select 1 from students s where s.id = student_id and is_family_member(s.family_id))
  );
create policy "write own bindings" on student_curricula
  for all using (
    exists (select 1 from students s where s.id = student_id and is_family_member(s.family_id))
  )
  with check (
    exists (select 1 from students s where s.id = student_id and is_family_member(s.family_id))
  );

create policy "read own coop memberships" on coop_memberships
  for select using (is_family_member(family_id));
create policy "join a coop" on coop_memberships
  for insert with check (is_family_member(family_id));
create policy "leave a coop" on coop_memberships
  for delete using (is_family_member(family_id));

create policy "read own handoffs" on bede_handoffs
  for select using (is_family_member(family_id));
