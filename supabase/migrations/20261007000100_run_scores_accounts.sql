-- HealthWiz Kingdom running leaderboard (Runners' Board) for signed-in players. Used by js/v6-runboard.js.
-- Needs 20261006000000_run_scores.sql. Run once in the Supabase SQL editor (or `supabase db push`). Safe to run again.
--
-- Signed out, nothing changes: a device takes part with its random device_id (submit_run_score / leave_run_board).
-- Signed in, the board entry belongs to the account instead, so it follows the player to every device:
--   * run_members holds the account's nickname (one row per joined account). Private: no grants, no policies.
--   * run_scores rows get a user_id. Each device still sends the weekly totals of the runs recorded on it (a run is
--     only ever on the device that recorded it), and run_board() adds an account's devices together.
--   * On the first sign-in on a device, claim_run_scores() moves that device's rows to the account.
--   * Device-only functions can no longer change or delete rows that belong to an account.
-- Still shared: a nickname and weekly running totals. Never shared: health data, location, e-mail, user ids.

alter table public.run_scores add column if not exists user_id uuid references auth.users (id) on delete cascade;
create index if not exists run_scores_user on public.run_scores (user_id) where user_id is not null;
-- user_id stays private like device_id: the public may read only the nickname and stats columns (granted before).

create table if not exists public.run_members (
  user_id   uuid        primary key references auth.users (id) on delete cascade,
  nickname  text        not null check (char_length(nickname) between 3 and 16),
  joined_at timestamptz not null default now()
);
comment on table public.run_members is 'HealthWiz Kingdom running leaderboard: nickname of each joined account (written only via functions).';
alter table public.run_members enable row level security;
revoke all on public.run_members from anon, authenticated;

-- One place for the checks both submit functions make. Raises 22023 (HTTP 400) with a readable message.
create or replace function public.run_score_check(
  p_nickname text, p_week_start date, p_distance_km numeric, p_runs integer, p_moving_sec integer, p_best_5k_sec integer)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if not public.run_nick_ok(p_nickname) then
    raise exception 'nickname: 3-16 letters, numbers, spaces, _ . - and nothing rude' using errcode = '22023';
  end if;
  if p_distance_km is null or p_distance_km < 0 or p_distance_km > 100 then raise exception 'distance must be 0-100 km per week' using errcode = '22023'; end if;
  if p_runs is null or p_runs < 0 or p_runs > 50 then raise exception 'runs must be 0-50 per week' using errcode = '22023'; end if;
  if (p_distance_km > 0) <> (p_runs > 0) then raise exception 'distance and runs must both be zero or both positive' using errcode = '22023'; end if;
  if p_distance_km > 0 and (p_moving_sec is null or p_moving_sec < p_distance_km * 150 or p_moving_sec > p_distance_km * 900) then
    raise exception 'average pace must be 2:30-15:00 min/km' using errcode = '22023';
  end if;
  if p_best_5k_sec is not null and (p_best_5k_sec < 750 or p_best_5k_sec > 4500 or p_distance_km < 5) then
    raise exception 'best 5K must be 12:30-75:00 (2:30-15:00 min/km) from a run of 5 km or more' using errcode = '22023';
  end if;
end $$;

create or replace function public.run_week_ok(p_week_start date) returns void
language plpgsql stable set search_path = '' as $$
begin
  if p_week_start is null or extract(isodow from p_week_start) <> 1
     or p_week_start < current_date - 14 or p_week_start > current_date + 1 then
    raise exception 'week_start must be the Monday of this week or last week' using errcode = '22023';
  end if;
end $$;

-- at most one submit per minute per device (shared by both submit functions)
create or replace function public.run_rate(p_device_id uuid) returns void
language plpgsql set search_path = '' as $$
declare ok integer;
begin
  insert into public.run_submits as s (device_id, at) values (p_device_id, now())
  on conflict (device_id) do update set at = excluded.at where s.at <= now() - interval '1 minute'
  returning 1 into ok;
  if ok is null then raise exception 'one submit per minute, try again shortly' using errcode = 'PT429'; end if;
end $$;

/* ---------- signed out (device), as before but hands off account rows ---------- */
create or replace function public.submit_run_score(
  p_device_id uuid, p_nickname text, p_week_start date,
  p_distance_km numeric, p_runs integer, p_moving_sec integer, p_best_5k_sec integer default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  n text := btrim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g'));
  d numeric := round(coalesce(p_distance_km, -1), 2);
begin
  if p_device_id is null then raise exception 'device id missing' using errcode = '22023'; end if;
  perform public.run_score_check(n, p_week_start, d, p_runs, p_moving_sec, p_best_5k_sec);
  perform public.run_week_ok(p_week_start);
  if exists (select 1 from public.run_scores s where s.device_id = p_device_id and s.user_id is not null) then
    raise exception 'this device''s board entry belongs to an account: sign in to update it' using errcode = '42501';
  end if;
  perform public.run_rate(p_device_id);

  if p_runs = 0 then
    delete from public.run_scores where device_id = p_device_id and week_start = p_week_start and user_id is null;
  else
    insert into public.run_scores as r (device_id, nickname, week_start, distance_km, runs, best_5k_sec, updated_at)
    values (p_device_id, n, p_week_start, d, p_runs, p_best_5k_sec, now())
    on conflict (device_id, week_start) do update set
      nickname = excluded.nickname, distance_km = excluded.distance_km, runs = excluded.runs,
      best_5k_sec = excluded.best_5k_sec, updated_at = excluded.updated_at
    where r.user_id is null;
  end if;
  update public.run_scores set nickname = n where device_id = p_device_id and user_id is null and nickname <> n;
end $$;

create or replace function public.leave_run_board(p_device_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare k integer;
begin
  if p_device_id is null then raise exception 'device id missing' using errcode = '22023'; end if;
  delete from public.run_scores where device_id = p_device_id and user_id is null;
  get diagnostics k = row_count;
  delete from public.run_submits where device_id = p_device_id;
  return k;
end $$;

/* ---------- signed in (account) ---------- */
-- Has this account joined, and under which nickname?
create or replace function public.run_me() returns table (joined boolean, nickname text)
language sql stable security definer set search_path = '' as $$
  select m.user_id is not null, m.nickname
  from (select 1) one left join public.run_members m on m.user_id = auth.uid()
$$;

-- Join (or rename) with this account. p_device_id (optional): this device's rows move to the account.
create or replace function public.run_join_me(p_nickname text, p_device_id uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  n text := btrim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g'));
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if not public.run_nick_ok(n) then
    raise exception 'nickname: 3-16 letters, numbers, spaces, _ . - and nothing rude' using errcode = '22023';
  end if;
  insert into public.run_members as m (user_id, nickname) values (me, n)
  on conflict (user_id) do update set nickname = excluded.nickname;
  if p_device_id is not null then
    update public.run_scores set user_id = me where device_id = p_device_id and user_id is null;
  end if;
  update public.run_scores set nickname = n where user_id = me and nickname <> n;
end $$;

-- First sign-in on a device that had joined the board on its own: its rows move to the account. When the account
-- had already joined (on another device), its nickname is kept; otherwise the device's nickname becomes the account's.
create or replace function public.claim_run_scores(p_device_id uuid, p_nickname text default null)
returns table (joined boolean, nickname text) language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  n text := btrim(regexp_replace(coalesce(p_nickname, ''), '\s+', ' ', 'g'));
  cur text;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select m.nickname into cur from public.run_members m where m.user_id = me;
  if cur is null then
    if public.run_nick_ok(n) then cur := n;
    else select s.nickname into cur from public.run_scores s where s.device_id = p_device_id and s.user_id is null order by s.week_start desc limit 1;
    end if;
    if cur is not null then insert into public.run_members (user_id, nickname) values (me, cur) on conflict (user_id) do nothing; end if;
  end if;
  if cur is not null and p_device_id is not null then
    update public.run_scores s set user_id = me where s.device_id = p_device_id and s.user_id is null;
    update public.run_scores s set nickname = cur where s.user_id = me and s.nickname <> cur;
  end if;
  return query select cur is not null, cur;
end $$;

-- Submit (or update) one week's totals from this device for the account. The nickname is the account's.
create or replace function public.submit_run_score_me(
  p_device_id uuid, p_week_start date,
  p_distance_km numeric, p_runs integer, p_moving_sec integer, p_best_5k_sec integer default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  d numeric := round(coalesce(p_distance_km, -1), 2);
  n text;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_device_id is null then raise exception 'device id missing' using errcode = '22023'; end if;
  select m.nickname into n from public.run_members m where m.user_id = me;
  if n is null then raise exception 'join the board first' using errcode = '22023'; end if;
  perform public.run_score_check(n, p_week_start, d, p_runs, p_moving_sec, p_best_5k_sec);
  perform public.run_week_ok(p_week_start);
  if exists (select 1 from public.run_scores s where s.device_id = p_device_id and s.user_id is not null and s.user_id <> me) then
    raise exception 'this device''s board entry belongs to another account' using errcode = '42501';
  end if;
  perform public.run_rate(p_device_id);

  update public.run_scores set user_id = me where device_id = p_device_id and user_id is null;
  if p_runs = 0 then
    delete from public.run_scores where device_id = p_device_id and week_start = p_week_start and user_id = me;
  else
    insert into public.run_scores as r (device_id, user_id, nickname, week_start, distance_km, runs, best_5k_sec, updated_at)
    values (p_device_id, me, n, p_week_start, d, p_runs, p_best_5k_sec, now())
    on conflict (device_id, week_start) do update set
      user_id = excluded.user_id, nickname = excluded.nickname, distance_km = excluded.distance_km, runs = excluded.runs,
      best_5k_sec = excluded.best_5k_sec, updated_at = excluded.updated_at
    where r.user_id = me;
  end if;
end $$;

-- Leave with this account: every row of the account (from all its devices) and its nickname are deleted.
create or replace function public.leave_run_board_me() returns integer
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); k integer;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  delete from public.run_scores where user_id = me;
  get diagnostics k = row_count;
  delete from public.run_members where user_id = me;
  return k;
end $$;

/* ---------- the boards: one entry per account (all its devices added up) or per signed-out device ---------- */
create or replace function public.run_board(p_board text, p_week date default null, p_device_id uuid default null, p_sort text default 'km')
returns table (rank bigint, nickname text, distance_km numeric, runs bigint, weeks bigint, best_5k_sec integer, me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if p_board not in ('week', 'all', '5k') or coalesce(p_sort, 'km') not in ('km', 'runs') then
    raise exception 'unknown board' using errcode = '22023';
  end if;
  if p_board = 'week' and p_week is null then raise exception 'p_week required' using errcode = '22023'; end if;
  return query
  with w as (   -- one line per player per week: an account's devices added up
    select s.user_id as acct, case when s.user_id is null then s.device_id end as dev, s.week_start,
      (array_agg(s.nickname order by s.updated_at desc))[1] as nick,
      sum(s.distance_km) as dist, sum(s.runs)::bigint as nruns, min(s.best_5k_sec) as b5
    from public.run_scores s
    where p_board <> 'week' or s.week_start = p_week
    group by 1, 2, 3
  ), b as (
    select w.acct, w.dev,
      (array_agg(w.nick order by w.week_start desc))[1] as nick,
      sum(w.dist) as dist, sum(w.nruns)::bigint as nruns,
      count(*) filter (where w.nruns > 0) as nweeks, min(w.b5) as b5
    from w
    group by w.acct, w.dev
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
    select k.*,
      (uid is not null and k.acct = uid) or (p_device_id is not null and k.acct is null and k.dev = p_device_id) as mine,
      rank() over (order by k.k1 desc, k.k2 desc) as rk,
      row_number() over (order by k.k1 desc, k.k2 desc, k.nick, k.acct, k.dev) as rn
    from k
  )
  select r.rk, r.nick, r.dist, r.nruns, r.nweeks, r.b5, r.mine
  from r
  where r.rn <= 50 or r.mine
  order by r.rn;
end $$;

revoke all on function public.run_score_check(text, date, numeric, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.run_week_ok(date) from public, anon, authenticated;
revoke all on function public.run_rate(uuid) from public, anon, authenticated;
revoke all on function public.submit_run_score(uuid, text, date, numeric, integer, integer, integer) from public;
revoke all on function public.leave_run_board(uuid) from public;
revoke all on function public.run_board(text, date, uuid, text) from public;
revoke all on function public.run_me() from public, anon;
revoke all on function public.run_join_me(text, uuid) from public, anon;
revoke all on function public.claim_run_scores(uuid, text) from public, anon;
revoke all on function public.submit_run_score_me(uuid, date, numeric, integer, integer, integer) from public, anon;
revoke all on function public.leave_run_board_me() from public, anon;
grant execute on function public.submit_run_score(uuid, text, date, numeric, integer, integer, integer) to anon, authenticated;
grant execute on function public.leave_run_board(uuid) to anon, authenticated;
grant execute on function public.run_board(text, date, uuid, text) to anon, authenticated;
grant execute on function public.run_me() to authenticated;
grant execute on function public.run_join_me(text, uuid) to authenticated;
grant execute on function public.claim_run_scores(uuid, text) to authenticated;
grant execute on function public.submit_run_score_me(uuid, date, numeric, integer, integer, integer) to authenticated;
grant execute on function public.leave_run_board_me() to authenticated;
