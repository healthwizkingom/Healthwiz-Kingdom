-- HealthWiz Kingdom: the Guild War of Joules (used by js/v6-arcana.js). Needs 20261003000000_hw_cloud_save.sql.
-- Run once in the Supabase SQL editor (or `supabase db push`). Safe to run again.
--
-- Opt-in. A player who chooses SHARE MY GUILD TOTALS sends their block and two weekly totals: work against gravity (J) and
-- estimated energy (kJ). Nothing else: no name, weight, steps, entries or times.
-- Reading is through hw_guild_totals() only, for signed-in players. It returns per-block sums for one week and hides any block
-- with fewer than 3 players, so no single player's numbers can be read back. User ids are never returned.

create table if not exists public.hw_guild (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  block      text        not null check (block in ('Blok A','Blok B','Blok C','Blok E','Blok Aisyah','Blok FAZ','Other / day student')),
  wk         date        not null,                                   -- Monday of the player's local week
  work_j     bigint      not null default 0 check (work_j between 0 and 50000000),
  energy_kj  bigint      not null default 0 check (energy_kj between 0 and 500000),
  updated_at timestamptz not null default now()
);
comment on table public.hw_guild is 'HealthWiz guild totals: opt-in, one row per player, read only as per-block sums.';

alter table public.hw_guild enable row level security;
drop policy if exists "hw_guild read own"   on public.hw_guild;
drop policy if exists "hw_guild delete own" on public.hw_guild;
create policy "hw_guild read own"   on public.hw_guild for select to authenticated using ((select auth.uid()) = user_id);
create policy "hw_guild delete own" on public.hw_guild for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.hw_guild from anon, authenticated;
grant select, delete on public.hw_guild to authenticated;
create index if not exists hw_guild_wk on public.hw_guild (wk, block);

-- Write the caller's own row (values clamped to the table's ranges).
create or replace function public.hw_guild_publish(p_block text, p_wk date, p_work_j numeric, p_energy_kj numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if p_wk is null or p_wk < current_date - 8 or p_wk > current_date + 1 then raise exception 'week out of range' using errcode = '22023'; end if;
  insert into public.hw_guild as g (user_id, block, wk, work_j, energy_kj, updated_at)
  values (me, p_block, p_wk,
          least(greatest(coalesce(floor(p_work_j), 0), 0), 50000000)::bigint,
          least(greatest(coalesce(floor(p_energy_kj), 0), 0), 500000)::bigint, now())
  on conflict (user_id) do update set block = excluded.block, wk = excluded.wk, work_j = excluded.work_j,
    energy_kj = excluded.energy_kj, updated_at = excluded.updated_at;
end $$;

-- Per-block sums for one week; blocks with fewer than 3 players are left out.
create or replace function public.hw_guild_totals(p_wk date)
returns table (block text, members bigint, work_j bigint, energy_kj bigint)
language sql stable security definer set search_path = '' as $$
  select g.block, count(*)::bigint, sum(g.work_j)::bigint, sum(g.energy_kj)::bigint
  from public.hw_guild g
  where auth.uid() is not null and g.wk = p_wk
  group by g.block
  having count(*) >= 3
  order by sum(g.work_j) desc, g.block;
$$;

revoke all on function public.hw_guild_publish(text, date, numeric, numeric) from public, anon;
revoke all on function public.hw_guild_totals(date) from public, anon;
grant execute on function public.hw_guild_publish(text, date, numeric, numeric) to authenticated;
grant execute on function public.hw_guild_totals(date) to authenticated;
