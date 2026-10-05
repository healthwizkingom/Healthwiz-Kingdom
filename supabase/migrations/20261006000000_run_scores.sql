-- HealthWiz Kingdom running leaderboard (used by js/v6-runboard.js). Independent of the cloud save: no sign-in needed.
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run), or `supabase db push`.
-- Safe to run again.
--
-- What is stored: a nickname and weekly running totals (distance, number of runs, best 5K time), one row per
-- device per week. No health data, no location or route, no weight, no account, no e-mail.
-- Identity: device_id, a random UUID made by the app and kept in that browser's localStorage. It is never readable
-- by anyone (no SELECT on that column), so nobody can write or delete another player's rows.
--
-- Access (the app only ever uses the PUBLISHABLE / anon key):
--   * Row Level Security is on. Nobody can INSERT, UPDATE or DELETE the tables directly.
--   * Writes go through submit_run_score() (validated, max one submit per minute per device) and
--     leave_run_board() (deletes all of that device's rows).
--   * Anyone may SELECT nickname + stats columns of run_scores (not device_id, not id). The app reads the ranked
--     boards through run_board(), which aggregates weeks for "All time" and flags the caller's own row, again
--     without ever returning a device_id.

create table if not exists public.run_scores (
  id          bigint generated always as identity primary key,
  device_id   uuid         not null,
  nickname    text         not null check (char_length(nickname) between 3 and 16),
  week_start  date         not null check (extract(isodow from week_start) = 1),          -- Monday (device's local week)
  distance_km numeric(6,2) not null default 0 check (distance_km between 0 and 100),
  runs        integer      not null default 0 check (runs between 0 and 50),
  best_5k_sec integer      check (best_5k_sec is null or best_5k_sec between 750 and 4500),  -- 2:30–15:00 min/km × 5
  updated_at  timestamptz  not null default now(),
  constraint run_scores_device_week unique (device_id, week_start)
);
comment on table public.run_scores is 'HealthWiz Kingdom running leaderboard: nickname + weekly running totals per device. Opt-in; written only via submit_run_score().';

create index if not exists run_scores_week on public.run_scores (week_start, distance_km desc);

-- last submit per device (rate limit). Private: no grants, no policies.
create table if not exists public.run_submits (
  device_id uuid        primary key,
  at        timestamptz not null default now()
);
comment on table public.run_submits is 'HealthWiz Kingdom running leaderboard: time of the last submit per device (rate limit only).';

alter table public.run_scores  enable row level security;
alter table public.run_submits enable row level security;

-- Supabase grants every privilege on new public tables: take them all back, then grant only what is public.
revoke all on public.run_scores  from anon, authenticated;
revoke all on public.run_submits from anon, authenticated;
grant select (nickname, week_start, distance_km, runs, best_5k_sec, updated_at) on public.run_scores to anon, authenticated;

drop policy if exists "run_scores public read" on public.run_scores;
create policy "run_scores public read" on public.run_scores for select to anon, authenticated using (true);

-- Nickname rules shared by submit: 3–16 letters/numbers/space/_ . -, no profanity (English + Malay, leetspeak folded).
create or replace function public.run_nick_ok(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p is not null
     and char_length(p) between 3 and 16
     and p ~ '^[[:alnum:]][[:alnum:] _.-]*$'
     and regexp_replace(translate(lower(p), '0134578@$!|', 'oieastbasii'), '[^a-z]', '', 'g')
         !~ '(fuck|fuk|shit|bitch|cunt|dick|cock|pussy|asshole|bastard|nigg|fag|slut|whore|rape|porn|penis|vagina|boob|babi|bodoh|pukimak|puki|lancau|pantat|celaka|keparat|kimak|butoh|pepek|haramjadah|taik|burit|sundal|jalang|bangsat|sial|kote)'
$$;

-- Submit (or update) one week's totals for this device.
--   p_moving_sec: moving time of the counted runs; used only to check the average pace (2:30–15:00 min/km), never stored.
--   p_runs = 0 removes that week's row (e.g. after the only run of the week was deleted).
-- Errors: 22023 invalid input (HTTP 400), PT429 more than one submit per minute (HTTP 429).
create or replace function public.submit_run_score(
  p_device_id uuid, p_nickname text, p_week_start date,
  p_distance_km numeric, p_runs integer, p_moving_sec integer, p_best_5k_sec integer default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  n text := btrim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g'));
  d numeric := round(coalesce(p_distance_km, -1), 2);
  ok integer;
begin
  if p_device_id is null then raise exception 'device id missing' using errcode = '22023'; end if;
  if not public.run_nick_ok(n) then
    raise exception 'nickname: 3-16 letters, numbers, spaces, _ . - and nothing rude' using errcode = '22023';
  end if;
  if p_week_start is null or extract(isodow from p_week_start) <> 1
     or p_week_start < current_date - 14 or p_week_start > current_date + 1 then
    raise exception 'week_start must be the Monday of this week or last week' using errcode = '22023';
  end if;
  if d < 0 or d > 100 then raise exception 'distance must be 0-100 km per week' using errcode = '22023'; end if;
  if p_runs is null or p_runs < 0 or p_runs > 50 then raise exception 'runs must be 0-50 per week' using errcode = '22023'; end if;
  if (d > 0) <> (p_runs > 0) then raise exception 'distance and runs must both be zero or both positive' using errcode = '22023'; end if;
  if d > 0 and (p_moving_sec is null or p_moving_sec < d * 150 or p_moving_sec > d * 900) then
    raise exception 'average pace must be 2:30-15:00 min/km' using errcode = '22023';
  end if;
  if p_best_5k_sec is not null and (p_best_5k_sec < 750 or p_best_5k_sec > 4500 or d < 5) then
    raise exception 'best 5K must be 12:30-75:00 (2:30-15:00 min/km) from a run of 5 km or more' using errcode = '22023';
  end if;

  -- at most one submit per minute per device (atomic: the row is only updated when the last submit is old enough)
  insert into public.run_submits as s (device_id, at) values (p_device_id, now())
  on conflict (device_id) do update set at = excluded.at where s.at <= now() - interval '1 minute'
  returning 1 into ok;
  if ok is null then raise exception 'one submit per minute, try again shortly' using errcode = 'PT429'; end if;

  if p_runs = 0 then
    delete from public.run_scores where device_id = p_device_id and week_start = p_week_start;
  else
    insert into public.run_scores as r (device_id, nickname, week_start, distance_km, runs, best_5k_sec, updated_at)
    values (p_device_id, n, p_week_start, d, p_runs, p_best_5k_sec, now())
    on conflict (device_id, week_start) do update set
      nickname = excluded.nickname, distance_km = excluded.distance_km, runs = excluded.runs,
      best_5k_sec = excluded.best_5k_sec, updated_at = excluded.updated_at;
  end if;
  -- one name per device across all its weeks
  update public.run_scores set nickname = n where device_id = p_device_id and nickname <> n;
end $$;

-- Leave the board: deletes every row of this device. Returns how many weekly rows were removed.
create or replace function public.leave_run_board(p_device_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare k integer;
begin
  if p_device_id is null then raise exception 'device id missing' using errcode = '22023'; end if;
  delete from public.run_scores where device_id = p_device_id;
  get diagnostics k = row_count;
  delete from public.run_submits where device_id = p_device_id;
  return k;
end $$;

-- A ranked board: top 50 (shared ranks for ties) plus the caller's own row when it is outside the top 50.
--   p_board 'week' (needs p_week, a Monday) | 'all' (all weeks added up) | '5k' (fastest best 5K)
--   p_sort  'km' (distance first) | 'runs' (consistency first: runs per week; all time: active weeks, then runs)
--   p_device_id only marks `me`; it is never returned.
create or replace function public.run_board(p_board text, p_week date default null, p_device_id uuid default null, p_sort text default 'km')
returns table (rank bigint, nickname text, distance_km numeric, runs bigint, weeks bigint, best_5k_sec integer, me boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_board not in ('week', 'all', '5k') or coalesce(p_sort, 'km') not in ('km', 'runs') then
    raise exception 'unknown board' using errcode = '22023';
  end if;
  if p_board = 'week' and p_week is null then raise exception 'p_week required' using errcode = '22023'; end if;
  return query
  with b as (
    select s.device_id,
      (array_agg(s.nickname order by s.week_start desc))[1] as nick,
      sum(s.distance_km) as dist, sum(s.runs)::bigint as nruns,
      count(*) filter (where s.runs > 0) as nweeks, min(s.best_5k_sec) as b5
    from public.run_scores s
    where p_board <> 'week' or s.week_start = p_week
    group by s.device_id
  ), k as (
    select b.*,
      case when p_board = '5k' then -b.b5::numeric
           when coalesce(p_sort, 'km') = 'km' then b.dist
           when p_board = 'all' then b.nweeks::numeric
           else b.nruns::numeric end as k1,
      case when p_board = '5k' then 0::numeric
           when coalesce(p_sort, 'km') = 'km' then (case when p_board = 'all' then b.nweeks else b.nruns end)::numeric
           when p_board = 'all' then b.nruns::numeric
           else b.dist end as k2
    from b
    where (p_board <> '5k' or b.b5 is not null) and b.nruns > 0
  ), r as (
    select k.*, rank() over (order by k.k1 desc, k.k2 desc) as rk,
           row_number() over (order by k.k1 desc, k.k2 desc, k.nick, k.device_id) as rn
    from k
  )
  select r.rk, r.nick, r.dist, r.nruns, r.nweeks, r.b5, (p_device_id is not null and r.device_id = p_device_id)
  from r
  where r.rn <= 50 or (p_device_id is not null and r.device_id = p_device_id)
  order by r.rn;
end $$;

revoke all on function public.run_nick_ok(text) from public;
revoke all on function public.submit_run_score(uuid, text, date, numeric, integer, integer, integer) from public;
revoke all on function public.leave_run_board(uuid) from public;
revoke all on function public.run_board(text, date, uuid, text) from public;
grant execute on function public.run_nick_ok(text) to anon, authenticated;
grant execute on function public.submit_run_score(uuid, text, date, numeric, integer, integer, integer) to anon, authenticated;
grant execute on function public.leave_run_board(uuid) to anon, authenticated;
grant execute on function public.run_board(text, date, uuid, text) to anon, authenticated;
