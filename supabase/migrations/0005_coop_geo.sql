-- Coarse meeting areas for co-operative listings, published by their directors.
--
-- Normative source: the "Co-op discovery" section of the portal spec
-- (art_ztdch8TP). This adds no new granularity of geography: it expresses the
-- metro-area precision the platform has always used for a co-operative as a
-- centroid and a tolerance, so the directory can be ordered by distance on a
-- "near me" action.
--
-- What is deliberately NOT here, enforced by the invariant tests:
--
--   * no street address, postcode, ZIP, or city column
--   * anywhere to store a household's or a person's coordinates — the
--     searching parent's location is taken from the browser on an explicit
--     action, used client-side to order results, and never sent to the server
--     for storage
--
-- A director publishing their own listing may publish where their co-operative
-- meets at metro precision. It is the co-op's own choice — the same one it
-- makes today by naming its region — and a listing that declines keeps the
-- region-only presentation, which is why every column below is nullable.

alter table public.coop_listings
  add column if not exists meeting_area_lat double precision,
  add column if not exists meeting_area_lng double precision,
  add column if not exists meeting_area_radius_mi int check (meeting_area_radius_mi between 1 and 50);

-- Published together or not at all: a centroid with no longitude is a data
-- entry error, not a location. The database enforces the pairing rather than
-- trusting every writer to remember.
alter table public.coop_listings
  drop constraint if exists coop_meeting_area_paired;
alter table public.coop_listings
  add constraint coop_meeting_area_paired
  check ((meeting_area_lat is null) = (meeting_area_lng is null));
