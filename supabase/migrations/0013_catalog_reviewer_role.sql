-- Its own file: Postgres will not use a new enum value in the transaction that
-- adds it, and 0014 uses this one.
alter type portal_role add value if not exists 'catalog_reviewer';
