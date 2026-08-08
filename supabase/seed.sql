-- Public-zone seed data. Organisations and products only: there is nothing here
-- keyed to a family, a household or a child, and there is nowhere in this schema
-- to put such a thing.

insert into public.curricula
  (slug, title, publisher, subject, grade_min, grade_max, philosophy, description, bede_support)
values
  ('saxon-math-7-6', 'Saxon Math 7/6', 'Saxon', 'Math', '6', '7', 'traditional',
   'Incremental development with continual review.', 'native'),
  ('saxon-algebra-1', 'Algebra 1', 'Saxon', 'Math', '8', '10', 'traditional',
   'Standard first-year algebra with Saxon''s spiral review.', 'native'),
  ('rod-staff-english-5', 'Building Christian English 5', 'Rod & Staff', 'Language Arts', '5', '5', 'traditional',
   'Rigorous grammar and composition with a heavy diagramming emphasis.', 'native'),
  ('memoria-latina-christiana', 'Latina Christiana I', 'Memoria Press', 'Latin', '3', '6', 'classical',
   'Introductory ecclesiastical Latin with weekly vocabulary and grammar forms.', 'native'),
  ('memoria-famous-men-rome', 'Famous Men of Rome', 'Memoria Press', 'History', '4', '6', 'classical',
   'Narrative Roman history through biography.', 'assisted'),
  ('apologia-astronomy', 'Exploring Creation: Astronomy', 'Apologia', 'Science', 'K', '6', 'charlotte-mason',
   'Elementary astronomy built around notebooking and narration.', 'assisted'),
  ('story-of-the-world-1', 'The Story of the World, Vol. 1', 'Well-Trained Mind Press', 'History', '1', '4', 'classical',
   'Ancient history read aloud, with narration and mapwork.', 'native'),
  ('baltimore-catechism-1', 'Baltimore Catechism No. 1', 'TAN Books', 'Religion', '3', '6', 'traditional',
   'Question-and-answer catechesis in the traditional form.', 'assisted'),
  ('traditional-logic-1', 'Traditional Logic I', 'Memoria Press', 'Logic', '8', '10', 'classical',
   'Formal deductive logic: terms, propositions and syllogisms.', 'assisted'),
  ('artistic-pursuits-k3', 'Artistic Pursuits K-3', 'Artistic Pursuits', 'Art', 'K', '3', 'charlotte-mason',
   'Studio art paired with picture study.', 'unsupported')
on conflict (slug) do nothing;

insert into public.resource_links (title, url, subject, description)
values
  ('Project Gutenberg', 'https://www.gutenberg.org', 'Literature',
   'Public-domain texts, which covers most of a classical reading list.'),
  ('Library of Congress: Primary Source Sets', 'https://www.loc.gov/programs/teachers/classroom-materials/primary-source-sets/', 'History',
   'Primary documents grouped by topic, free to use.'),
  ('Perseus Digital Library', 'https://www.perseus.tufts.edu', 'Latin',
   'Greek and Latin texts with parsing and lexicon tools.')
on conflict (url) do nothing;

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
