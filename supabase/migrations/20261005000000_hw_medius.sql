-- HealthWiz Kingdom: daily message allowance for Medius's AI counsel (master prompt §41–42; used by
-- supabase/functions/medius-chat). Needs nothing else. Run once in the Supabase SQL editor (or `supabase db push`). Safe to run again.
--
-- Only a counter is stored: who, which day, how many messages. Never the messages themselves.
-- hw_medius_take() adds one to the caller's own count for today (UTC) and returns the new count; the Edge Function
-- refuses the request when it is above the daily limit. A player calling it directly can only use up their own allowance.

create table if not exists public.hw_medius_use (
  user_id uuid    not null references auth.users (id) on delete cascade,
  day     date    not null,
  n       integer not null default 0 check (n >= 0),
  primary key (user_id, day)
);
comment on table public.hw_medius_use is 'HealthWiz Kingdom: AI counsel messages per player per day (count only, no content).';

alter table public.hw_medius_use enable row level security;
drop policy if exists "hw_medius_use read own" on public.hw_medius_use;
create policy "hw_medius_use read own" on public.hw_medius_use for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.hw_medius_use from anon, authenticated;
grant select on public.hw_medius_use to authenticated;

create or replace function public.hw_medius_take()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cnt integer;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.hw_medius_use as u (user_id, day, n)
    values (uid, (now() at time zone 'utc')::date, 1)
    on conflict (user_id, day) do update set n = u.n + 1
    returning u.n into cnt;
  delete from public.hw_medius_use where user_id = uid and day < (now() at time zone 'utc')::date - 7;  -- keep a week
  return cnt;
end;
$$;
revoke all on function public.hw_medius_take() from public, anon;
grant execute on function public.hw_medius_take() to authenticated;
