-- Public-zone seed data. Organizations and products only: there is nothing here
-- keyed to a family, a household or a child, and there is nowhere in this schema
-- to put such a thing.

-- Catalog records arrive as staged candidates and are published only by a
-- human reviewer (0014). Nothing here is published; review it locally with
-- public.review_candidate.
insert into public.catalog_candidates
  (kind, title, subject, url, source_url, retrieved_on, agent_run_id)
values
  ('resource', 'Project Gutenberg', 'Literature', 'https://www.gutenberg.org', 'https://www.gutenberg.org', '2026-10-21', 'seed'),
  ('resource', 'Library of Congress: Primary Source Sets', 'History',
   'https://www.loc.gov/programs/teachers/classroom-materials/primary-source-sets/',
   'https://www.loc.gov/programs/teachers/classroom-materials/primary-source-sets/', '2026-10-21', 'seed'),
  ('resource', 'Perseus Digital Library', 'Latin', 'https://www.perseus.tufts.edu', 'https://www.perseus.tufts.edu', '2026-10-21', 'seed')
on conflict do nothing;

-- Co-operatives list themselves. There is no roster: docs/portal.md §10 puts
-- membership in a groups.md group, about which the operator learns nothing.
insert into public.coop_listings
  (slug, name, state_code, region, description, meeting_day, enquiry_ref)
values
  ('st-jerome-classical', 'St. Jerome Classical Co-op', 'TX', 'North Dallas',
   'A classical Catholic co-op meeting weekly for Latin, logic and rhetoric.', 'Tuesday', 'SJC-4820'),
  ('hill-country-scholars', 'Hill Country Scholars', 'TX', 'Austin',
   'Mixed-age co-op focused on science labs and writing workshops.', 'Thursday', 'HCS-1177')
on conflict (slug) do nothing;
