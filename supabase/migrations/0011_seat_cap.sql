-- A contract's seat cap holds where seats are written (amendment 2 §4.5).
-- Null is unlimited enrolled seats; it says nothing about simultaneous use.
-- An account with no active entitlement keeps today's per-purchase seats.
create function public.enforce_seat_cap() returns trigger
language plpgsql as $$
declare
  cap integer;
begin
  if new.state <> 'active' then
    return new;
  end if;

  -- Locked so two concurrent issues cannot both see room for one.
  select seat_cap into cap from public.entitlements
   where account_id = new.account_id and status = 'active'
   for update;

  if cap is not null and (
    select count(*) from public.seats
     where account_id = new.account_id and state = 'active' and id <> new.id
  ) >= cap then
    raise exception 'seat cap of % reached for this contract', cap;
  end if;
  return new;
end
$$;

create trigger enforce_seat_cap before insert or update of state on public.seats
  for each row execute function public.enforce_seat_cap();
