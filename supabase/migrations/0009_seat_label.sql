-- The child's name leaves the hosted zone. An opaque, parent-chosen seat label
-- takes its place as consent evidence (DECISIONS.md, seat label; blueprint §3.1).

-- Rows written before this migration hold real names. Turning them into labels
-- would rewrite consent evidence, so that is a decision for a person, not a
-- migration.
do $$
begin
  if exists (select 1 from consent.consent_records) then
    raise exception 'consent records exist; replacing child names in evidence needs an owner decision';
  end if;
end
$$;

alter table consent.consent_records drop column child_account_name;

-- <parent-word>.<code>. The code alphabet drops 0, 1, i, l and o so a parent
-- cannot misread their own label. A rename overwrites this value; there is no
-- history table and no trigger, by decision.
alter table consent.consent_records
  add column seat_label text not null
  constraint seat_label_format
  check (seat_label ~ '^[a-z]{2,24}\.[2-9a-hjkmnp-z]{4,6}$');

-- The code tells apart two seats a parent gave the same word. Keyed by the
-- adult because the account does not exist until consent is granted.
create unique index consent_records_seat_code_idx
  on consent.consent_records (owner_user_id, split_part(seat_label, '.', 2));
