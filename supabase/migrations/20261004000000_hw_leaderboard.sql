-- HealthWiz Kingdom leaderboard (master prompt §78–80, §91; used by js/v6-board.js). Needs 20261003000000_hw_cloud_save.sql.
-- Run once in the Supabase SQL editor (or `supabase db push`). Safe to run again.
--
-- Game progression only (§78): XP, XP this week, quests, achievements, kingdom progress, exploration, gentle streak.
-- There is no column for BMI, weight, calories, entries or any other health value, so none can ever be ranked or shown.
-- Opt-in: a row exists only while the player has joined. Leaving deletes it; deleting the account deletes it too.
--
-- Access: no one can insert or update rows directly. hw_board_publish() writes the caller's own row, taking XP and
-- badges from the caller's own cloud save (hw_saves) and clamping everything else to sane ranges.
-- Reading is through hw_board_top() only, for signed-in players: it returns ranks, names and scores, never user ids,
-- e-mail addresses or timestamps, and shows a hidden player as a nameless "hidden adventurer" to everyone else.

create table if not exists public.hw_board (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text        not null check (char_length(name) between 3 and 20),
  hidden     boolean     not null default false,
  xp         bigint      not null default 0 check (xp >= 0),
  week_xp    integer     not null default 0 check (week_xp >= 0),
  wk         date,                                    -- Monday of the week `week_xp` belongs to (player's local week)
  quests     integer     not null default 0 check (quests >= 0),
  badges     integer     not null default 0 check (badges >= 0),
  kingdom    integer     not null default 0 check (kingdom between 0 and 100),
  explore    integer     not null default 0 check (explore >= 0),
  streak     integer     not null default 0 check (streak >= 0),
  updated_at timestamptz not null default now()
);
comment on table public.hw_board is 'HealthWiz Kingdom leaderboard: game progress only, opt-in, written and read through functions.';

alter table public.hw_board enable row level security;
drop policy if exists "hw_board read own"   on public.hw_board;
drop policy if exists "hw_board delete own" on public.hw_board;
create policy "hw_board read own"   on public.hw_board for select to authenticated using ((select auth.uid()) = user_id);
create policy "hw_board delete own" on public.hw_board for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.hw_board from anon, authenticated;
grant select, delete on public.hw_board to authenticated;

create index if not exists hw_board_xp   on public.hw_board (xp desc);
create index if not exists hw_board_week on public.hw_board (wk, week_xp desc);

-- Join or refresh the caller's entry. p_stats = {week_xp, wk, quests, kingdom, explore, streak} (numbers, wk 'YYYY-MM-DD').
create or replace function public.hw_board_publish(p_name text, p_hidden boolean, p_stats jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  d jsonb;
  n text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_xp bigint;
  v_badges integer;
  v_wk date;
  num constant text := '^[0-9]{1,12}(\.[0-9]+)?$';
  st jsonb := case when jsonb_typeof(p_stats) = 'object' then p_stats else '{}'::jsonb end;
  g jsonb := '{}'::jsonb;
  k text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if char_length(n) not between 3 and 20 or n !~ '^[[:alnum:]][[:alnum:] ._''-]*$' then
    raise exception 'hero name: 3-20 letters, numbers, spaces, . _ '' -' using errcode = '22023';
  end if;
  select s.data into d from public.hw_saves s where s.user_id = me;
  if d is null then raise exception 'sync your cloud save first' using errcode = '22023'; end if;

  -- XP and badges come from the cloud save, not from the request
  v_xp := case when coalesce(d ->> 'xp', '') ~ num then least(floor((d ->> 'xp')::numeric), 1000000000)::bigint else 0 end;
  v_badges := case when jsonb_typeof(d -> 'b') = 'object' then (select count(*) from jsonb_object_keys(d -> 'b'))::int else 0 end;

  foreach k in array array['week_xp', 'quests', 'kingdom', 'explore', 'streak'] loop
    g := g || jsonb_build_object(k, case when coalesce(st ->> k, '') ~ num then floor((st ->> k)::numeric)::bigint else 0 end);
  end loop;
  v_wk := case when coalesce(st ->> 'wk', '') ~ '^\d{4}-\d{2}-\d{2}$' then (st ->> 'wk')::date end;
  if v_wk is not null and (v_wk < current_date - 8 or v_wk > current_date + 1) then v_wk := null; end if;

  insert into public.hw_board as b (user_id, name, hidden, xp, week_xp, wk, quests, badges, kingdom, explore, streak, updated_at)
  values (me, n, coalesce(p_hidden, false), v_xp,
          case when v_wk is null then 0 else least((g ->> 'week_xp')::bigint, v_xp, 100000)::int end, v_wk,
          least((g ->> 'quests')::bigint, 100000)::int, v_badges,
          least((g ->> 'kingdom')::bigint, 100)::int,
          least((g ->> 'explore')::bigint, 10000)::int,
          least((g ->> 'streak')::bigint, 3660)::int, now())
  on conflict (user_id) do update set
    name = excluded.name, hidden = excluded.hidden, xp = excluded.xp, week_xp = excluded.week_xp, wk = excluded.wk,
    quests = excluded.quests, badges = excluded.badges, kingdom = excluded.kingdom, explore = excluded.explore,
    streak = excluded.streak, updated_at = excluded.updated_at;
end $$;

-- One board: 'xp' | 'week' (p_week = the caller's Monday) | 'quests' | 'badges' | 'kingdom' | 'explore' | 'streak'.
-- Returns the top p_limit (max 50) with shared ranks for ties, plus the caller's own row when it is not among them.
create or replace function public.hw_board_top(p_board text, p_week date default null, p_limit integer default 20)
returns table (rank bigint, name text, value bigint, xp bigint, me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  lim integer := greatest(1, least(coalesce(p_limit, 20), 50));
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_board not in ('xp', 'week', 'quests', 'badges', 'kingdom', 'explore', 'streak') then
    raise exception 'unknown board' using errcode = '22023';
  end if;
  return query
  with v as (
    select b.user_id, b.name, b.hidden, b.xp as total,
      (case p_board when 'xp' then b.xp when 'week' then b.week_xp when 'quests' then b.quests when 'badges' then b.badges
                    when 'kingdom' then b.kingdom when 'explore' then b.explore else b.streak end)::bigint as score
    from public.hw_board b
    where p_board <> 'week' or (p_week is not null and b.wk = p_week)
  ), r as (
    select v.*, rank() over (order by v.score desc) as rk, row_number() over (order by v.score desc, v.name, v.user_id) as rn
    from v where v.score > 0 or v.user_id = uid
  )
  select r.rk, case when r.hidden and r.user_id <> uid then null else r.name end, r.score, r.total, r.user_id = uid
  from r
  where r.rn <= lim or r.user_id = uid
  order by r.rn;
end $$;

revoke all on function public.hw_board_publish(text, boolean, jsonb) from public, anon;
revoke all on function public.hw_board_top(text, date, integer) from public, anon;
grant execute on function public.hw_board_publish(text, boolean, jsonb) to authenticated;
grant execute on function public.hw_board_top(text, date, integer) to authenticated;
