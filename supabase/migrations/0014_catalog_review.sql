-- The catalog is metadata and links, staged by agents and published only by a
-- human reviewer (blueprint §6). Launch stores bede_support as NULL
-- (DECISIONS.md): no support claim until one is sourced.

-- Account-wide roles hold a null co-op. The old primary key made that column
-- NOT NULL, so no moderator or reviewer could ever be granted.
alter table public.user_roles drop constraint user_roles_pkey;
alter table public.user_roles alter column coop_listing_id drop not null;
create unique index user_roles_unique_idx on public.user_roles (user_id, role, coop_listing_id) nulls not distinct;

alter table public.curricula alter column bede_support drop not null, alter column bede_support drop default;
update public.curricula set bede_support = null;

-- Description is dropped: the pipeline collects no publisher prose.
alter table public.curricula
  drop column description,
  add column url text,
  add column faith_content boolean not null default false,
  add column source_url text,
  add column retrieved_on date,
  add column reviewed_by uuid references auth.users (id),
  add column reviewed_at timestamptz;
alter table public.resource_links
  drop column description,
  add column faith_content boolean not null default false,
  add column source_url text,
  add column retrieved_on date,
  add column reviewed_by uuid references auth.users (id),
  add column reviewed_at timestamptz;

-- Every record published from here on is sourced, linked, and reviewed. Older
-- rows are not validated, and the read policies below hide them.
alter table public.curricula add constraint curricula_reviewed
  check (url is not null and source_url is not null and reviewed_by is not null and reviewed_at is not null) not valid;
alter table public.resource_links add constraint resource_links_reviewed
  check (source_url is not null and reviewed_by is not null and reviewed_at is not null) not valid;

drop policy "catalogue is public" on public.curricula;
create policy "reviewed catalog is public" on public.curricula for select using (reviewed_at is not null);
drop policy "resources are public" on public.resource_links;
create policy "reviewed resources are public" on public.resource_links for select using (reviewed_at is not null);

-- Nothing writes the published tables directly, the service role included.
-- The reviewer is evidence for the operator, not a public fact.
revoke all on public.curricula, public.resource_links from anon, authenticated, service_role;
grant select (id, slug, title, publisher, subject, grade_min, grade_max, philosophy, url, bede_support,
              faith_content, source_url, retrieved_on, reviewed_at, created_at)
  on public.curricula to anon, authenticated, service_role;
grant select (id, title, url, subject, faith_content, source_url, retrieved_on, reviewed_at, created_at)
  on public.resource_links to anon, authenticated, service_role;

create type catalog_kind as enum ('curriculum', 'resource');
create type candidate_state as enum ('staged', 'approved', 'rejected');

create table public.catalog_candidates (
  id uuid primary key default gen_random_uuid(),
  kind catalog_kind not null,
  title text not null check (char_length(title) between 1 and 200),
  publisher text,
  subject text not null,
  grade_min text,
  grade_max text,
  philosophy text,
  url text not null check (url ~ '^https://'),
  source_url text not null check (source_url ~ '^https://'),
  retrieved_on date not null,
  faith_content boolean not null default false,
  agent_run_id text not null,
  state candidate_state not null default 'staged',
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind <> 'curriculum' or publisher is not null),
  check ((state = 'staged') = (reviewed_by is null))
);

-- Duplicate detection: one live candidate per link.
create unique index catalog_candidates_url_idx on public.catalog_candidates (url) where state <> 'rejected';

alter table public.catalog_candidates enable row level security;
create policy "reviewers read candidates" on public.catalog_candidates
  for select using (has_role('catalog_reviewer'));

-- The only path to publication. An agent runs as the service role with no
-- signed-in user, so it can stage but never approve its own work.
create function public.review_candidate(candidate uuid, approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.catalog_candidates;
begin
  if auth.uid() is null or not has_role('catalog_reviewer') then
    raise exception 'only a signed-in catalog reviewer can review';
  end if;

  update public.catalog_candidates
     set state = case when approve then 'approved'::candidate_state else 'rejected' end,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = candidate and state = 'staged'
  returning * into c;
  if not found then
    raise exception 'no staged candidate %', candidate;
  end if;

  if not approve then
    return;
  end if;

  if c.kind = 'curriculum' then
    insert into public.curricula
      (slug, title, publisher, subject, grade_min, grade_max, philosophy, url,
       faith_content, source_url, retrieved_on, reviewed_by, reviewed_at)
    values
      (trim(both '-' from regexp_replace(lower(c.publisher || '-' || c.title), '[^a-z0-9]+', '-', 'g')),
       c.title, c.publisher, c.subject, c.grade_min, c.grade_max, c.philosophy, c.url,
       c.faith_content, c.source_url, c.retrieved_on, c.reviewed_by, c.reviewed_at);
  else
    insert into public.resource_links
      (title, url, subject, faith_content, source_url, retrieved_on, reviewed_by, reviewed_at)
    values
      (c.title, c.url, c.subject, c.faith_content, c.source_url, c.retrieved_on, c.reviewed_by, c.reviewed_at);
  end if;
end
$$;

revoke all on function public.review_candidate(uuid, boolean) from public, anon;
grant execute on function public.review_candidate(uuid, boolean) to authenticated;
