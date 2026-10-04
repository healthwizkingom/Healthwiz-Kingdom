-- HealthWiz Kingdom GPS runs (used by js/v6-running.js). Needs 20261003000000_hw_cloud_save.sql (the same sign-in).
-- Run once in the Supabase SQL editor (or `supabase db push`). Safe to run again.
--
-- One private row per finished run. Row Level Security: an account can only read, add and delete its own runs,
-- so the app only ever needs the PUBLISHABLE (anon) key. Never put a secret / service_role key in the app.
-- Runs are not edited after they are saved, so there is no update policy.
-- The id is made on the device: a retried upload of the same run hits the primary key (409) and is never stored twice.
--
-- route: the GPS track as segments (a new segment after every pause), each a list of [lat, lng, t] points,
-- t = seconds since started_at. Example: [[[5.351988, 100.538377, 0], [5.352040, 100.538410, 4]]].

create table if not exists public.hw_runs (
  id            uuid        primary key,
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  started_at    timestamptz not null,
  finished_at   timestamptz not null,
  distance_m    integer     not null check (distance_m between 0 and 1000000),     -- up to 1,000 km
  duration_s    integer     not null check (duration_s between 0 and 604800),      -- moving time, pauses excluded
  pace_s_per_km integer     check (pace_s_per_km is null or pace_s_per_km > 0),    -- average pace; null below 10 m
  route         jsonb       not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  constraint hw_runs_order check (finished_at >= started_at),
  constraint hw_runs_route check (jsonb_typeof(route) = 'array' and pg_column_size(route) <= 2000000)
);
comment on table public.hw_runs is 'HealthWiz Kingdom GPS runs: one private row per run (RLS).';

create index if not exists hw_runs_user_started on public.hw_runs (user_id, started_at desc);

alter table public.hw_runs enable row level security;

drop policy if exists "hw_runs read own"   on public.hw_runs;
drop policy if exists "hw_runs insert own" on public.hw_runs;
drop policy if exists "hw_runs delete own" on public.hw_runs;
create policy "hw_runs read own"   on public.hw_runs for select to authenticated using ((select auth.uid()) = user_id);
create policy "hw_runs insert own" on public.hw_runs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "hw_runs delete own" on public.hw_runs for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.hw_runs from anon;
grant select, insert, delete on public.hw_runs to authenticated;
