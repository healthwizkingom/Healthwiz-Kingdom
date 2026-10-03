-- HealthWiz Kingdom cloud save (master prompt §75–76, §79, §91; used by js/v6-cloud.js).
-- Run once in the Supabase SQL editor (or `supabase db push`). Safe to run again.
--
-- One private row per account. Row Level Security: an account can only read and write its own row,
-- so the app only ever needs the PUBLISHABLE (anon) key. Never put a secret / service_role key in the app.

create table if not exists public.hw_saves (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  rev        bigint      not null default 1,          -- bumped by the server on every write
  sv         integer     not null check (sv > 0),     -- HealthWiz data schema version of `data`
  data       jsonb       not null,                    -- the whole save (same shape as a backup's `data`)
  device     text        check (char_length(device) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hw_saves_shape check (jsonb_typeof(data) = 'object' and jsonb_typeof(data -> 'e') = 'array'),
  constraint hw_saves_size  check (pg_column_size(data) <= 4000000)
);
comment on table public.hw_saves is 'HealthWiz Kingdom cloud save: one private row per account (RLS).';

alter table public.hw_saves enable row level security;

drop policy if exists "hw_saves read own"   on public.hw_saves;
drop policy if exists "hw_saves insert own" on public.hw_saves;
drop policy if exists "hw_saves update own" on public.hw_saves;
drop policy if exists "hw_saves delete own" on public.hw_saves;
create policy "hw_saves read own"   on public.hw_saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "hw_saves insert own" on public.hw_saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "hw_saves update own" on public.hw_saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "hw_saves delete own" on public.hw_saves for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.hw_saves from anon;
grant select, insert, update, delete on public.hw_saves to authenticated;

-- The server owns rev and the timestamps. The app writes with `?rev=eq.<n>`, so a write based on an old
-- copy updates no row and the app merges first (no blind overwrites between devices).
create or replace function public.hw_saves_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.rev := 1;
    new.created_at := now();
  else
    new.rev := old.rev + 1;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists hw_saves_stamp on public.hw_saves;
create trigger hw_saves_stamp before insert or update on public.hw_saves
  for each row execute function public.hw_saves_stamp();

-- Settings → Cloud Save → DELETE ACCOUNT (§79). Deletes only the caller's own account; the save row goes with it.
create or replace function public.hw_delete_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.hw_delete_account() from public, anon;
grant execute on function public.hw_delete_account() to authenticated;
