-- Corrections found by executing the schema for the first time. Both were
-- invisible to the string-scanning tests, because both are behaviours rather
-- than text.

-- ---------------------------------------------------------------------------
-- 1. Row-level security does not hide columns.
-- ---------------------------------------------------------------------------
--
-- docs/portal.md §12 says `listings.posted_by_account` "is never exposed to any
-- reader", and the communication waiver tells parents it "is never shown to
-- anyone reading the exchange". Both were false. A policy restricts which rows
-- come back; every column of a returned row is readable. Any account could read
-- the poster of every listing and correlate them, which is the persistent
-- pseudonym §7 prohibits and the posting history §7 says does not exist.
--
-- Revoking the column alone does nothing: a table-level SELECT grant already
-- carries every column, and a column-level revoke does not cut into it. The
-- grant has to be replaced by an explicit column list, which is also the form
-- that fails loudly when a column is added without deciding who may read it.

revoke select on public.listings from anon, authenticated;
grant select (
  id, category, title, body, state_code, region, posted_as, state,
  expires_at, created_at
) on public.listings to anon, authenticated;

revoke select on public.listing_replies from anon, authenticated;
grant select (id, listing_id, body, created_at)
  on public.listing_replies to anon, authenticated;

revoke select on public.listing_reports from anon, authenticated;
grant select (id, listing_id, reason, resolved_at, created_at)
  on public.listing_reports to anon, authenticated;

-- The service role bypasses RLS and needs the hidden columns: acting on a report
-- is the reason docs/portal.md §12 keeps them at all.
grant select on public.listings, public.listing_replies, public.listing_reports
  to service_role;

-- ---------------------------------------------------------------------------
-- 2. An author could not withdraw their own listing.
-- ---------------------------------------------------------------------------
--
-- The only SELECT policy on listings was `state = 'active' and not expired`, so
-- an author's own row became invisible to them the moment it stopped being
-- active. Postgres will not let a row be updated out of visibility, so setting
-- `state` to 'withdrawn' failed with a row-level security violation.
--
-- That broke more than a tidy-up button. `withdrawWaiver` withdraws the
-- account's listings, and the waiver promises in terms that withdrawing stops
-- them being shown, so the waiver's own exit path did not work.
--
-- An author seeing their own listings in every state is also just correct: the
-- public policy governs what the public sees, not what an author sees of their
-- own.

create policy "authors see their own listings" on public.listings
  for select using (posted_by_account = current_account_id());
