-- Replies expire after 12 months (DECISIONS.md, amendment 1 §4.4). No keep
-- mechanism exists yet, so none is consulted. The job's only output is a
-- count, so its run log carries no reply content.
create function public.expire_replies() returns integer
language sql security definer set search_path = public as $$
  with gone as (
    delete from public.listing_replies where created_at < now() - interval '12 months' returning 1
  )
  select count(*)::integer from gone
$$;

revoke all on function public.expire_replies() from public, anon, authenticated;

-- Supabase ships pg_cron; a database without it (local tests) skips the schedule.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('expire-replies', '17 3 * * *', 'select public.expire_replies()');
  end if;
end
$$;
