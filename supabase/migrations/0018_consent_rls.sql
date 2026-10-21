-- Client roles already cannot reach the consent schema. RLS with no policy is
-- the second wall the release gate asks of every table; the consent pool runs
-- as the table owner, which RLS does not restrict.
alter table consent.consent_records enable row level security;
alter table consent.notice_versions enable row level security;
