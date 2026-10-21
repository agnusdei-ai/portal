-- Co-op families each hold their own entitlement under an opaque agreement ID
-- (amendment 2 §4.3). An ID that names a listed co-op would turn the
-- agreement's families into that co-op's member list, which the spec forbids.
create function public.agreement_names_no_coop() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from public.coop_listings where id::text = new.contract_id or slug = new.contract_id) then
    raise exception 'an agreement ID must not name a co-op listing';
  end if;
  return new;
end
$$;

create trigger agreement_names_no_coop before insert on public.entitlements
  for each row execute function public.agreement_names_no_coop();
