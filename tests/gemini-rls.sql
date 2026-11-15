-- Run only after applying 0017-0021 to a disposable/test DB.
-- All fixtures are rolled back; no external Gemini calls are performed.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
values
  ('a7000000-0000-4000-8000-000000000001', 'gemini-owner@example.invalid', 'test-only', '{}', '{}'),
  ('a7000000-0000-4000-8000-000000000002', 'gemini-other@example.invalid', 'test-only', '{}', '{}');
insert into public.wardrobes(id,owner_id,name,kind) values
  ('a7100000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','Gemini fixture','private');
insert into public.garments(id,wardrobe_id,owner_id,name,category,cleanliness,archived) values
 ('a7200000-0000-4000-8000-000000000001','a7100000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','Koszulka testowa','tops','clean',false),
 ('a7200000-0000-4000-8000-000000000002','a7100000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','Brudne spodnie','bottoms','dirty',false);

do $$ begin
  if has_function_privilege('authenticated', 'private.create_gemini_task_for_user(uuid,text,integer)', 'EXECUTE') then
    raise exception 'Authenticated clients must not call the internal task creation function';
  end if;
  if has_function_privilege('authenticated', 'private.save_gemini_credential_for_user(uuid,text,text)', 'EXECUTE') then
    raise exception 'Authenticated clients must not call internal credential functions';
  end if;
end $$;

set session authorization wardrobe_session;
select * from private.save_gemini_credential_for_user('a7000000-0000-4000-8000-000000000001', 'v1.a.a.a', 'x123');
select * from private.save_gemini_credential_for_user('a7000000-0000-4000-8000-000000000001', 'v1.b.b.b', 'y456');
select * from private.update_gemini_model_for_user('a7000000-0000-4000-8000-000000000001', 'models/gemini-test');
select * from private.create_gemini_task_for_user('a7000000-0000-4000-8000-000000000001', 'connection_test', 1);
select * from private.create_gemini_task_for_user('a7000000-0000-4000-8000-000000000001', 'connection_test', 1);
reset session authorization;
update public.gemini_tasks set status='completed' where user_id='a7000000-0000-4000-8000-000000000001';
set session authorization wardrobe_session;
select * from private.create_gemini_outfit_task_for_user(
 'a7000000-0000-4000-8000-000000000001',
 '{"wardrobe_id":"a7100000-0000-4000-8000-000000000001","occasion":"everyday","temperature":18,"count":2}'::jsonb, 3);
do $$ begin
  begin
    perform * from private.create_gemini_outfit_task_for_user(
      'a7000000-0000-4000-8000-000000000002',
      '{"wardrobe_id":"a7100000-0000-4000-8000-000000000001","occasion":"everyday","temperature":18,"count":2}'::jsonb, 3);
    raise exception 'Foreign wardrobe membership was not enforced';
  exception when insufficient_privilege then null;
  end;
end $$;
reset session authorization;
set session authorization wardrobe_worker;
do $$ declare ctx jsonb; begin
  select private.load_gemini_outfit_context(id) into ctx from public.gemini_tasks where kind='outfit_recommendation';
  if jsonb_array_length(ctx->'garments') <> 1 then raise exception 'Worker context leaked dirty/unavailable garments'; end if;
  if ctx->'garments'->0->>'id' <> 'a7200000-0000-4000-8000-000000000001' then raise exception 'Worker context returned wrong garment'; end if;
end $$;
reset session authorization;
set session authorization wardrobe_session;
do $$ begin
  begin
    perform * from private.create_gemini_task_for_user('a7000000-0000-4000-8000-000000000002', 'list_models', 1);
    raise exception 'Queue cap was not enforced';
  exception when sqlstate '53000' then null;
  end;
end $$;
reset session authorization;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
  if (select key_hint from public.gemini_credentials) <> 'y456' then raise exception 'Credential replacement failed'; end if;
  if (select model from public.gemini_credentials) <> 'models/gemini-test' then raise exception 'Credential model was not preserved'; end if;
  if (select count(*) from public.gemini_tasks) <> 2 then raise exception 'Task count/deduplication was incorrect'; end if;
  if has_column_privilege('authenticated', 'public.gemini_credentials', 'encrypted_key', 'SELECT') then
    raise exception 'Encrypted credential column was exposed to the user role';
  end if;
  begin
    perform encrypted_key from public.gemini_credentials;
    raise exception 'Encrypted credential column was exposed to the user role';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.gemini_credentials(user_id, encrypted_key, key_hint)
      values ('a7000000-0000-4000-8000-000000000002', 'v1.c.c.c', 'z789');
    raise exception 'Authenticated clients retain direct credential insert access';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.gemini_credentials set key_hint='z789'
      where user_id='a7000000-0000-4000-8000-000000000001';
    raise exception 'Authenticated clients retain direct credential update access';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.gemini_credentials where user_id='a7000000-0000-4000-8000-000000000001';
    raise exception 'Authenticated clients retain direct credential delete access';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"a7000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.gemini_tasks) <> 0 then raise exception 'RLS leaked another user task'; end if;
  if (select count(*) from public.gemini_credentials) <> 0 then raise exception 'RLS leaked another user credential'; end if;
end $$;
reset role;
set session authorization wardrobe_session;
select private.delete_gemini_credential_for_user('a7000000-0000-4000-8000-000000000001');
reset session authorization;
do $$ begin
  if exists (select 1 from public.gemini_credentials where user_id='a7000000-0000-4000-8000-000000000001') then
    raise exception 'Credential deletion failed';
  end if;
end $$;
rollback;
