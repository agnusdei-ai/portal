-- A faithful stand-in for the Supabase-provided auth environment, no more of
-- it than the migrations and policies actually touch: the users table, the
-- claim readers auth.uid()/auth.role(), and the roles the policies address.
-- Without the grants, row-level security is theater — policies are only
-- meaningful for roles that could otherwise see the tables.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text unique
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid;
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
$$;

-- Roles are cluster-wide but each test file bootstraps its own database
-- concurrently, so the plain check-then-create races on the rolname unique
-- index. The loser of that race catches duplicate_object: by the time it is
-- raised the winner's create has committed, so the grants below are safe.
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then
    begin
      create role anon nologin;
    exception when duplicate_object then null;
    end;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    begin
      create role authenticated nologin;
    exception when duplicate_object then null;
    end;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    begin
      create role service_role nologin;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- Run after the migrations: covers every table the schema defines, including
-- tables added by later migrations without each one re-granting.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
