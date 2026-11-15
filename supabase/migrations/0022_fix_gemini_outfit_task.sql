-- 0021 is already checksum-tracked. Replace the task RPC with an unambiguous
-- local variable name instead of editing an applied migration.
create or replace function private.create_gemini_outfit_task_for_user(
  p_user_id uuid, p_request jsonb, p_queue_limit integer
) returns table(id uuid, status text)
language plpgsql security definer set search_path = '' as $$
declare task_id uuid; v_wardrobe_id uuid;
begin
  if session_user <> 'wardrobe_session' then raise exception 'BFF role required' using errcode = '42501'; end if;
  if p_user_id is null or not exists (select 1 from auth.users u where u.id=p_user_id) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_request) <> 'object'
     or coalesce(p_request->>'occasion','') not in ('office','everyday','date','evening','weekend','travel')
     or coalesce(p_request->>'temperature','') !~ '^-?[0-9]+(\.[0-9]+)?$'
     or (p_request->>'temperature')::numeric not between -40 and 55
     or coalesce(p_request->>'count','') !~ '^[1-6]$'
     or length(coalesce(p_request->>'requirements','')) > 500
     or length(coalesce(p_request->>'weather','')) > 140
     or coalesce(p_request->>'wardrobe_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or p_queue_limit not between 1 and 1000 then
    raise exception 'invalid task request' using errcode = '22023';
  end if;
  v_wardrobe_id := (p_request->>'wardrobe_id')::uuid;
  if not exists (
    select 1 from public.wardrobe_members m
     where m.wardrobe_id=v_wardrobe_id and m.user_id=p_user_id
  ) then
    raise exception 'wardrobe access required' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(173450002);
  select t.id into task_id from public.gemini_tasks t
   where t.user_id=p_user_id and t.status in ('queued','running','retrying') limit 1;
  if task_id is not null then return query select task_id,'existing'::text; return; end if;
  if (select count(*) from public.gemini_tasks t where t.status in ('queued','running','retrying')) >= p_queue_limit then
    raise exception 'queue is full' using errcode = '53000';
  end if;
  insert into public.gemini_tasks(user_id,kind,request)
   values(p_user_id,'outfit_recommendation',p_request) returning public.gemini_tasks.id into task_id;
  return query select task_id,'queued'::text;
end $$;
revoke all on function private.create_gemini_outfit_task_for_user(uuid,jsonb,integer) from public,anon,authenticated,service_role;
grant execute on function private.create_gemini_outfit_task_for_user(uuid,jsonb,integer) to wardrobe_session;
