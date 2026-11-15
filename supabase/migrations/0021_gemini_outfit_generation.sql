-- Gemini outfit requests contain criteria only (never credentials or garment data).
alter table public.gemini_tasks add column request jsonb;
alter table public.gemini_tasks drop constraint gemini_tasks_kind_check;
alter table public.gemini_tasks add constraint gemini_tasks_kind_check
  check (kind in ('connection_test','list_models','outfit_recommendation'));

create function private.create_gemini_outfit_task_for_user(
  p_user_id uuid, p_request jsonb, p_queue_limit integer
) returns table(id uuid, status text)
language plpgsql security definer set search_path = '' as $$
declare task_id uuid; wardrobe_id uuid;
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
  wardrobe_id := (p_request->>'wardrobe_id')::uuid;
  if not exists (select 1 from public.wardrobe_members m where m.wardrobe_id=wardrobe_id and m.user_id=p_user_id) then
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

create function private.load_gemini_outfit_context(p_task_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare context jsonb;
begin
  if session_user <> 'wardrobe_worker' then raise exception 'worker role required' using errcode = '42501'; end if;
  select jsonb_build_object(
    'request',t.request,
    'profile',coalesce(p.style_profile,'{"schema_version":1,"answers":{},"skipped":[]} '::jsonb),
    'garments',coalesce(jsonb_agg(jsonb_build_object(
      'id',g.id,'name',g.name,'category',g.category,'subcategory',g.subcategory,
      'primary_color',g.primary_color,'secondary_color',g.secondary_color,'material',g.material,
      'seasons',g.seasons,'warmth',g.warmth,'thickness',g.thickness,'style',g.style,
      'pattern',g.pattern,'occasions',g.occasions
    ) order by g.created_at desc) filter (where g.id is not null),'[]'::jsonb)
  ) into context
  from public.gemini_tasks t
  join public.wardrobe_members m on m.user_id=t.user_id and m.wardrobe_id=(t.request->>'wardrobe_id')::uuid
  join public.profiles p on p.id=t.user_id
  left join public.garments g on g.wardrobe_id=m.wardrobe_id and g.cleanliness='clean' and not g.archived
  where t.id=p_task_id and t.kind='outfit_recommendation';
  if context is null then raise exception 'authorized task context not found' using errcode = 'P0002'; end if;
  return context;
end $$;
revoke all on function private.load_gemini_outfit_context(uuid) from public,anon,authenticated,service_role;
grant execute on function private.load_gemini_outfit_context(uuid) to wardrobe_worker;

create or replace function private.cancel_gemini_task_for_user(p_user_id uuid, p_task_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare task_status text;
begin
  if session_user <> 'wardrobe_session' then raise exception 'BFF role required' using errcode = '42501'; end if;
  update public.gemini_tasks t set status='cancelled',request=null,error_code='cancelled',
      error_message='Zadanie anulowano.',updated_at=now(),completed_at=now()
    where t.id=p_task_id and t.user_id=p_user_id and t.status in ('queued','running','retrying')
    returning t.status into task_status;
  if task_status is null then
    select t.status into task_status from public.gemini_tasks t where t.id=p_task_id and t.user_id=p_user_id;
  end if;
  if task_status is null then raise exception 'task not found' using errcode='P0002'; end if;
  return task_status;
end $$;
revoke all on function private.cancel_gemini_task_for_user(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.cancel_gemini_task_for_user(uuid,uuid) to wardrobe_session;
notify pgrst,'reload schema';
