-- Operators read reply text only for a reported listing or a support ticket,
-- from a multi-factor session, and every read is recorded (amendment 1 §4.5).
-- The record says who read which listing's replies and why, never what.
create table public.operator_reads (
  id uuid primary key default gen_random_uuid(),
  operator_user_id uuid not null references auth.users (id),
  listing_id uuid not null references public.listings (id) on delete cascade,
  reason text not null check (reason in ('report', 'support')),
  ticket_ref text check (ticket_ref ~ '^[A-Za-z0-9-]{3,40}$'),
  read_at timestamptz not null default now(),
  check ((reason = 'support') = (ticket_ref is not null))
);

alter table public.operator_reads enable row level security;
create policy "moderators read the audit log" on public.operator_reads
  for select using (has_role('moderator'));
-- Append-only, and only through the function below.
revoke insert, update, delete, truncate on public.operator_reads from anon, authenticated, service_role;

create function public.operator_read_replies(listing uuid, ticket text default null)
returns table (id uuid, body text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  why text;
begin
  if auth.uid() is null or not has_role('moderator') or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'operator reads need a moderator in a multi-factor session';
  end if;

  if ticket is not null then
    why := 'support';
  elsif exists (select 1 from public.listing_reports r where r.listing_id = listing) then
    why := 'report';
  else
    raise exception 'operator reads need a report on this listing or a support ticket';
  end if;

  insert into public.operator_reads (operator_user_id, listing_id, reason, ticket_ref)
  values (auth.uid(), listing, why, ticket);

  return query
    select r.id, r.body, r.created_at from public.listing_replies r
     where r.listing_id = listing order by r.created_at;
end
$$;

revoke all on function public.operator_read_replies(uuid, text) from public, anon;
grant execute on function public.operator_read_replies(uuid, text) to authenticated;
