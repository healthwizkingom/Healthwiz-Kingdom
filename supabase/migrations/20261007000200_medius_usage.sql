-- HealthWiz Kingdom: message limits for Medius's AI counsel (used by supabase/functions/medius-chat).
-- Run once in the Supabase SQL editor (or `supabase db push`), before deploying the function. Safe to run again.
--
-- Only counters are stored: who, which hour (UTC), how many messages. Never the messages themselves.
-- medius_take(hour_max, day_max) is called by the Edge Function with the player's own session. It counts one more
-- message for the caller and returns {ok: true, hour, day}, or {ok: false, scope: 'hour' | 'day', retry (seconds)}
-- without counting when the caller is at a limit. "Day" is the last 24 hours. A player calling it directly can only
-- use up their own allowance. Nobody can read or change the counts through the API.

create table if not exists public.medius_usage (
  user_id uuid        not null references auth.users (id) on delete cascade,
  hour    timestamptz not null,                    -- start of the UTC hour
  n       integer     not null default 0 check (n >= 0),
  primary key (user_id, hour)
);
comment on table public.medius_usage is 'HealthWiz Kingdom: AI counsel messages per player per hour (counts only, no content).';

alter table public.medius_usage enable row level security;
revoke all on public.medius_usage from anon, authenticated;

create or replace function public.medius_take(p_hour_max integer, p_day_max integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me  uuid        := auth.uid();
  h   timestamptz := date_trunc('hour', now());
  hn  integer;
  dn  integer;
  old timestamptz;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(me::text, 0));   -- one message at a time per player
  select coalesce(sum(u.n) filter (where u.hour = h), 0), coalesce(sum(u.n), 0), min(u.hour)
    into hn, dn, old
    from public.medius_usage u
    where u.user_id = me and u.hour > h - interval '24 hours';
  if hn >= greatest(1, coalesce(p_hour_max, 30)) then
    return jsonb_build_object('ok', false, 'scope', 'hour', 'hour', hn, 'day', dn,
      'retry', ceil(extract(epoch from (h + interval '1 hour' - now())))::int);
  end if;
  if dn >= greatest(1, coalesce(p_day_max, 100)) then
    -- the oldest counted hour leaves the 24-hour window first
    return jsonb_build_object('ok', false, 'scope', 'day', 'hour', hn, 'day', dn,
      'retry', greatest(60, ceil(extract(epoch from (old + interval '24 hours' - now())))::int));
  end if;
  insert into public.medius_usage as u (user_id, hour, n) values (me, h, 1)
  on conflict (user_id, hour) do update set n = u.n + 1;
  delete from public.medius_usage u where u.user_id = me and u.hour < h - interval '2 days';
  return jsonb_build_object('ok', true, 'hour', hn + 1, 'day', dn + 1);
end $$;

revoke all on function public.medius_take(integer, integer) from public, anon;
grant execute on function public.medius_take(integer, integer) to authenticated;

-- The first version of the counter (one row per day) is replaced by medius_usage. Counts only; nothing else is lost.
drop function if exists public.hw_medius_take();
drop table if exists public.hw_medius_use;
