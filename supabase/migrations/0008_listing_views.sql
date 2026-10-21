-- Corrections found by executing the schema. Both were invisible to a text
-- scan and both falsified a promise made to parents in writing.
--
-- 1. Row-level security does not hide columns. The only SELECT policy on
--    listings restricted rows; every column of a returned row was readable and
--    the exchange selected *. Any account could read posted_by_account for
--    every listing and correlate them: the persistent pseudonym portal.md §7
--    prohibits, and a column §12 and the waiver both say is never shown.
--
-- 2. An author could not withdraw their own listing. The only SELECT policy
--    was "active and unexpired", so an author's row became invisible to them
--    the moment it stopped being active, and Postgres refuses to update a row
--    out of visibility. withdrawWaiver withdraws listings, so the waiver's own
--    exit path failed.
--
-- The app filters on posted_by_account in four places (inbox, portal home,
-- rate limit, waiver withdrawal). A column needs SELECT privilege to be
-- filtered on, so hiding it means replacing the raw id with a computed `mine`.
-- That is what the views below are: the safe columns plus `mine`, reached
-- through a SECURITY DEFINER predicate so the id itself is never readable.
-- security_invoker keeps the base table's RLS in force for the caller.
--
-- Column privileges, not a revoke alone: a table-level SELECT grant already
-- carries every column, and a column revoke does not cut into it. The grant
-- is replaced with an explicit list, which also fails loudly when a column is
-- added without deciding who may read it.

create policy "authors see their own listings" on public.listings
  for select using (posted_by_account = current_account_id());

create function public.is_my_listing(target uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.listings
    where id = target and posted_by_account = current_account_id()
  );
$$;

create function public.is_my_reply(target uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.listing_replies
    where id = target and from_account = current_account_id()
  );
$$;

-- A policy's subquery into another table runs with the caller's privileges on
-- that table, so once posted_by_account is unreadable the reply-visibility
-- policy (0001) can no longer be evaluated at all. It is re-expressed through
-- the same definer predicate the view uses.
drop policy "reply visible to the two parties" on public.listing_replies;
create policy "reply visible to the two parties" on public.listing_replies
  for select using (
    from_account = current_account_id() or public.is_my_listing(listing_id)
  );

create view public.listings_v with (security_invoker = true) as
  select id, category, title, body, state_code, region, posted_as, state,
         expires_at, created_at,
         public.is_my_listing(id) as mine
  from public.listings;

create view public.listing_replies_v with (security_invoker = true) as
  select id, listing_id, body, created_at,
         public.is_my_reply(id) as mine
  from public.listing_replies;

revoke select on public.listings, public.listing_replies, public.listing_reports
  from anon, authenticated;

grant select (id, category, title, body, state_code, region, posted_as, state,
              expires_at, created_at)
  on public.listings to anon, authenticated;
grant select (id, listing_id, body, created_at)
  on public.listing_replies to anon, authenticated;
grant select on public.listings_v, public.listing_replies_v to anon, authenticated;

-- Nothing in the client reads reports; moderation is server-side (§12).
grant select on public.listings, public.listing_replies, public.listing_reports
  to service_role;
