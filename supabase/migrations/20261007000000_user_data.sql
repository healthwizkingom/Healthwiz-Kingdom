-- HealthWiz Kingdom: the account's private cloud copy of the save (used by js/v6-cloud.js).
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run), or `supabase db push`.
-- Safe to run again. Run it after 20261003000000_hw_cloud_save.sql and 20261004000000_hw_leaderboard.sql.
--
-- One row per account: user_id (= auth.uid()), data (the whole save, the same shape as a backup) and updated_at.
-- Row Level Security: a signed-in user can read, insert, update and delete only their own row. Nobody else can see it:
-- not other students, not the publishable (anon) key. The Wizard's Counsel chat is never part of `data`.
--
-- updated_at is set by the server on every write and only ever moves forward. The app writes with
-- `?updated_at=eq.<the value it last read>`, so a write based on an old copy changes nothing and the app merges first:
-- two devices never overwrite each other blindly.
--
-- This replaces hw_saves (the first cloud-save table): existing saves are copied over below, and the Hall of Heroes
-- now reads XP and badges from here. hw_saves is left in place, unused; drop it once you no longer need it.

create table if not exists public.user_data (
  user_id    uuid        primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  constraint user_data_shape check (jsonb_typeof(data) = 'object' and jsonb_typeof(data -> 'e') = 'array'),
  constraint user_data_size  check (pg_column_size(data) <= 4000000)
);
comment on table public.user_data is 'HealthWiz Kingdom: one private cloud save per account (RLS: own row only).';

alter table public.user_data enable row level security;

drop policy if exists "user_data read own"   on public.user_data;
drop policy if exists "user_data insert own" on public.user_data;
drop policy if exists "user_data update own" on public.user_data;
drop policy if exists "user_data delete own" on public.user_data;
create policy "user_data read own"   on public.user_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_data insert own" on public.user_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_data update own" on public.user_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_data delete own" on public.user_data for delete to authenticated using ((select auth.uid()) = user_id);

-- Supabase grants every privilege on new public tables: take them all back, then grant only what the app needs.
revoke all on public.user_data from anon, authenticated;
grant select, insert, update, delete on public.user_data to authenticated;

-- The server owns updated_at (strictly increasing per row) and the owner never changes.
create or replace function public.user_data_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  else
    new.updated_at := clock_timestamp();
  end if;
  return new;
end $$;

drop trigger if exists user_data_stamp on public.user_data;
create trigger user_data_stamp before insert or update on public.user_data
  for each row execute function public.user_data_stamp();

-- Copy saves from the older hw_saves table, when this project has one (rows already here are left alone).
do $$
begin
  if to_regclass('public.hw_saves') is not null then
    insert into public.user_data (user_id, data)
    select s.user_id, s.data from public.hw_saves s
    where jsonb_typeof(s.data) = 'object' and jsonb_typeof(s.data -> 'e') = 'array'
    on conflict (user_id) do nothing;
  end if;
end $$;

-- Hall of Heroes (20261004000000_hw_leaderboard.sql): XP and badges now come from user_data. Same rules as before.
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
  select s.data into d from public.user_data s where s.user_id = me;
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

revoke all on function public.hw_board_publish(text, boolean, jsonb) from public, anon;
grant execute on function public.hw_board_publish(text, boolean, jsonb) to authenticated;

-- Settings → ACCOUNT → DELETE ACCOUNT & CLOUD DATA. Deletes only the caller's own account. Everything that belongs to
-- it goes too (user_data, the older hw_saves row, Hall of Heroes, cloud runs, Runners' Board rows and membership,
-- Medius message counts), through `on delete cascade`.
create or replace function public.hw_delete_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from public.user_data where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.hw_delete_account() from public, anon;
grant execute on function public.hw_delete_account() to authenticated;
