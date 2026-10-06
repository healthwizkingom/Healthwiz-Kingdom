-- Behaviour checks for supabase/migrations (row level security, the cloud copy, the Runners' Board for accounts, Medius limits,
-- account deletion). Run with tools/test-sql.sh against a throwaway local PostgreSQL. Prints ALL SQL BEHAVIOUR CHECKS PASSED.
\set ON_ERROR_STOP 1
insert into auth.users values ('00000000-0000-4000-8000-00000000000a','a@x.io'),('00000000-0000-4000-8000-00000000000b','b@x.io');
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
  execute 'set local role authenticated'; end $$;
-- ---------- user_data ----------
begin;
select pg_temp.as_user('00000000-0000-4000-8000-00000000000a');
insert into public.user_data (data) values ('{"e":[],"xp":120,"b":{"x":"2026-10-01","y":"2026-10-02"}}');
do $$ declare n int; t1 timestamptz; t2 timestamptz; begin
  select count(*) into n from public.user_data; assert n = 1, 'A sees own row';
  select updated_at into t1 from public.user_data;
  update public.user_data set data = '{"e":[],"xp":130,"b":{}}' where updated_at = t1;
  select updated_at into t2 from public.user_data; assert t2 > t1, 'updated_at moves forward';
  update public.user_data set data = '{"e":[],"xp":1}' where updated_at = t1; get diagnostics n = row_count; assert n = 0, 'stale write changes nothing';
  begin insert into public.user_data (user_id, data) values ('00000000-0000-4000-8000-00000000000b','{"e":[]}'); assert false, 'insert for another user must fail';
  exception when insufficient_privilege or check_violation then null; when others then if sqlstate <> '42501' then raise; end if; end;
  begin update public.user_data set data = '{"e":"no"}'; assert false, 'shape check';
  exception when check_violation then null; end;
end $$;
commit;
begin;
select pg_temp.as_user('00000000-0000-4000-8000-00000000000b');
do $$ declare n int; begin select count(*) into n from public.user_data; assert n = 0, 'B cannot see A''s row';
  update public.user_data set data = '{"e":[]}'; get diagnostics n = row_count; assert n = 0, 'B cannot change A''s row';
  delete from public.user_data; get diagnostics n = row_count; assert n = 0, 'B cannot delete A''s row'; end $$;
commit;
begin; set local role anon;
do $$ begin perform 1 from public.user_data; assert false, 'anon must not read';
exception when insufficient_privilege then null; end $$;
commit;
-- Hall of Heroes reads XP and badges from user_data
begin;
select pg_temp.as_user('00000000-0000-4000-8000-00000000000a');
select public.hw_board_publish('Brave Otter 12', false, '{"week_xp":5,"wk":null,"quests":2}');
do $$ declare r record; begin select * into r from public.hw_board_top('xp') limit 1; assert r.value = 130 and r.me, 'board XP from user_data: '||r.value; end $$;
commit;
-- ---------- Runners' Board ----------
begin; set local role anon;
select public.submit_run_score('11111111-1111-4111-8111-111111111111','Swift Fox',(date_trunc('week', current_date))::date, 5.2, 1, 1600, 1538);
select public.submit_run_score('22222222-2222-4222-8222-222222222222','Calm Heron',(date_trunc('week', current_date))::date, 3.0, 2, 1200, null);
do $$ declare r record; begin
  select * into r from public.run_board('week', (date_trunc('week', current_date))::date, '11111111-1111-4111-8111-111111111111') where me; assert r.nickname = 'Swift Fox' and r.rank = 1, 'device row is mine';
end $$;
commit;
-- first sign-in on device 1: its rows move to account A
begin;
select pg_temp.as_user('00000000-0000-4000-8000-00000000000a');
do $$ declare r record; begin select * into r from public.run_me(); assert not r.joined, 'not joined yet';
  select * into r from public.claim_run_scores('11111111-1111-4111-8111-111111111111', 'Swift Fox'); assert r.joined and r.nickname = 'Swift Fox', 'claimed';
  select * into r from public.run_me(); assert r.joined and r.nickname = 'Swift Fox', 'joined after claim'; end $$;
commit;
-- the device id can no longer change the account's rows while signed out
begin; set local role anon;
do $$ begin perform public.submit_run_score('11111111-1111-4111-8111-111111111111','Hijack',(date_trunc('week', current_date))::date, 9, 1, 3000, null); assert false, 'must refuse';
exception when others then assert sqlstate = '42501', sqlstate; end $$;
do $$ declare k int; begin k := public.leave_run_board('11111111-1111-4111-8111-111111111111'); assert k = 0, 'device leave keeps account rows'; end $$;
commit;
-- a second device of account A adds its runs; the board shows one entry with both devices added up
begin;
select pg_temp.as_user('00000000-0000-4000-8000-00000000000a');
select public.submit_run_score_me('33333333-3333-4333-8333-333333333333',(date_trunc('week', current_date))::date, 4.0, 1, 1500, null);
do $$ declare r record; n int; begin
  select count(*) into n from public.run_board('week', (date_trunc('week', current_date))::date); assert n = 2, 'two players: '||n;
  select * into r from public.run_board('week', (date_trunc('week', current_date))::date) where me; assert r.distance_km = 9.2 and r.runs = 2 and r.nickname = 'Swift Fox', 'account totals: '||r.distance_km;
  select * into r from public.run_board('all', null, null, 'runs') where me; assert r.weeks = 1, 'one active week';
  begin perform public.submit_run_score_me('33333333-3333-4333-8333-333333333333',(date_trunc('week', current_date))::date, 4.0, 1, 1500, null); assert false, 'rate limit';
  exception when others then assert sqlstate = 'PT429', sqlstate; end;
  perform public.run_join_me('Steady Fox', null);
  select * into r from public.run_board('week', (date_trunc('week', current_date))::date) where me; assert r.nickname = 'Steady Fox', 'rename applies to all rows';
end $$;
commit;
-- account B cannot take A's device rows
begin;
select pg_temp.as_user('00000000-0000-4000-8000-00000000000b');
do $$ declare r record; begin
  select * into r from public.claim_run_scores('11111111-1111-4111-8111-111111111111', 'Bee Runner'); assert r.joined, 'B joins with its own name';
  perform public.submit_run_score_me('11111111-1111-4111-8111-111111111111',(date_trunc('week', current_date))::date, 1, 1, 400, null); assert false, 'must refuse';
exception when others then assert sqlstate = '42501', sqlstate; end $$;
commit;
begin;
select pg_temp.as_user('00000000-0000-4000-8000-00000000000a');
do $$ declare k int; n int; begin k := public.leave_run_board_me(); assert k = 2, 'both devices'' rows: '||k;
  select count(*) into n from public.run_board('all'); assert n = 1, 'only the other player stays'; end $$;
commit;
-- ---------- Medius limits ----------
begin;
select pg_temp.as_user('00000000-0000-4000-8000-00000000000b');
do $$ declare j jsonb; i int; begin
  for i in 1..30 loop j := public.medius_take(30, 100); assert (j->>'ok')::bool, 'msg '||i; end loop;
  j := public.medius_take(30, 100); assert not (j->>'ok')::bool and j->>'scope' = 'hour' and (j->>'retry')::int between 1 and 3600, j::text;
end $$;
commit;
-- counts in earlier hours: the 24-hour window adds them up
insert into public.medius_usage values ('00000000-0000-4000-8000-00000000000b', date_trunc('hour', now()) - interval '3 hours', 70);
begin;
select pg_temp.as_user('00000000-0000-4000-8000-00000000000b');
do $$ declare j jsonb; begin j := public.medius_take(200, 100); assert not (j->>'ok')::bool and j->>'scope' = 'day', j::text;
  assert (j->>'retry')::int > 19*3600, 'day retry '||(j->>'retry'); end $$;
commit;
begin; set local role anon;
do $$ begin perform public.medius_take(30, 100); assert false, 'anon refused'; exception when insufficient_privilege then null; end $$;
commit;
-- ---------- delete account: everything goes ----------
begin;
select pg_temp.as_user('00000000-0000-4000-8000-00000000000b');
select public.hw_delete_account();
commit;
do $$ declare n int; begin
  select count(*) into n from public.medius_usage where user_id = '00000000-0000-4000-8000-00000000000b'; assert n = 0, 'counts deleted';
  select count(*) into n from public.run_members where user_id = '00000000-0000-4000-8000-00000000000b'; assert n = 0, 'membership deleted';
  select count(*) into n from auth.users; assert n = 1;
end $$;
select 'ALL SQL BEHAVIOUR CHECKS PASSED' as result;
