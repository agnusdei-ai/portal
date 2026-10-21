-- An account whose contract does not allow faith content never reads it
-- (amendment 2 §4.6). School plans default to that; family and co-op plans,
-- visitors, and accounts with no contract see the whole reviewed catalog.
create function public.faith_content_allowed() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce(
    (select allow_faith_content from public.entitlements
      where account_id = current_account_id() and status = 'active'),
    true)
$$;

drop policy "reviewed catalog is public" on public.curricula;
create policy "reviewed catalog is public" on public.curricula
  for select using (reviewed_at is not null and (not faith_content or public.faith_content_allowed()));

drop policy "reviewed resources are public" on public.resource_links;
create policy "reviewed resources are public" on public.resource_links
  for select using (reviewed_at is not null and (not faith_content or public.faith_content_allowed()));
