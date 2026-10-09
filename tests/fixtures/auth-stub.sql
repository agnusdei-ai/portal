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
-- concurrently, so racing clients collide on shared catalog state in two
-- ways: concurrent `create role` raises unique_violation (23505) on the
-- rolname unique index rather than the friendly duplicate_object (42710),
-- and concurrent `grant` raises `tuple concurrently updated`. Both are
-- transient by construction — one client's write commits and the other's
-- retry finds the work already done — so the whole stub runs inside a
-- bounded retry: the inner guards absorb the fast-path role races, the
-- outer loop absorbs the rest, and a persistent failure still raises.
do $$
  declare
    attempt int;
  begin
    for attempt in 1..25 loop
      begin
        if not exists (select from pg_roles where rolname = 'anon') then
          begin
            create role anon nologin;
          exception when duplicate_object or unique_violation then null;
          end;
        end if;
        if not exists (select from pg_roles where rolname = 'authenticated') then
          begin
            create role authenticated nologin;
          exception when duplicate_object or unique_violation then null;
          end;
        end if;
        if not exists (select from pg_roles where rolname = 'service_role') then
          begin
            create role service_role nologin;
          exception when duplicate_object or unique_violation then null;
          end;
        end if;

        -- Run after the migrations: covers every table the schema defines,
        -- including tables added by later migrations without each one
        -- re-granting.
        grant usage on schema public to anon, authenticated, service_role;
        grant all on all tables in schema public to anon, authenticated, service_role;
        grant all on all functions in schema public to anon, authenticated, service_role;
        grant all on all sequences in schema public to anon, authenticated, service_role;
        return;
      exception when others then
        if attempt = 25 then raise; end if;
        perform pg_sleep(0.02);
      end;
    end loop;
  end $$;
