-- Seed data for local development. Enough catalog to exercise the directory
-- and the curriculum step of the wizard.

insert into curricula (slug, title, publisher, subject, grade_min, grade_max, philosophy, description, bede_support)
values
  ('saxon-math-7-6', 'Saxon Math 7/6', 'Saxon', 'Math', '6', '7', 'traditional',
   'Incremental development with continual review. Bede has the full lesson sequence.', 'native'),
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
   'Formal deductive logic — terms, propositions, and syllogisms.', 'assisted'),
  ('artistic-pursuits-k3', 'Artistic Pursuits K-3', 'Artistic Pursuits', 'Art', 'K', '3', 'charlotte-mason',
   'Studio art paired with picture study.', 'unsupported')
on conflict (slug) do nothing;

insert into coops (slug, name, state_code, region, description, meeting_day, join_code)
values
  ('st-jerome-classical', 'St. Jerome Classical Co-op', 'TX', 'North Dallas',
   'A classical Catholic co-op meeting weekly for Latin, logic, and rhetoric.', 'Tuesday', 'STJEROME26'),
  ('hill-country-scholars', 'Hill Country Scholars', 'TX', 'Austin',
   'Mixed-age co-op focused on science labs and writing workshops.', 'Thursday', 'HILLCTRY26')
on conflict (slug) do nothing;

-- St. Jerome teaches Latin and logic together; families cover the rest at home.
insert into coop_curricula (coop_id, curriculum_id, grade_level)
select c.id, k.id, '5'
from coops c, curricula k
where c.slug = 'st-jerome-classical' and k.slug = 'memoria-latina-christiana'
on conflict do nothing;

insert into coop_curricula (coop_id, curriculum_id, grade_level)
select c.id, k.id, '9'
from coops c, curricula k
where c.slug = 'st-jerome-classical' and k.slug = 'traditional-logic-1'
on conflict do nothing;
