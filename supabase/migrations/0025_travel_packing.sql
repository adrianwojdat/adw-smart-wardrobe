-- Additive migration. Apply through the normal checksum-tracked migrator.
alter table public.gemini_tasks drop constraint gemini_tasks_kind_check;
alter table public.gemini_tasks add constraint gemini_tasks_kind_check
 check(kind in ('connection_test','list_models','outfit_recommendation','travel_packing'));
create table public.packing_lists (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 wardrobe_id uuid not null references public.wardrobes(id) on delete cascade,
 name text not null check(length(name) between 1 and 160),
 trip jsonb not null check(jsonb_typeof(trip)='object'),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 80),
 allow_reuse boolean not null default false,
 updated_at timestamptz not null default now()
);
create index packing_lists_owner on public.packing_lists(user_id,updated_at desc);
alter table public.packing_lists enable row level security;
create policy packing_lists_owner on public.packing_lists for all to authenticated
 using(user_id=auth.uid() and public.has_wardrobe_access(wardrobe_id))
 with check(user_id=auth.uid() and public.has_wardrobe_access(wardrobe_id));
grant select,insert,update,delete on public.packing_lists to authenticated;
-- Invoker trigger checks assigned garments using the caller's RLS, also for direct REST writes.
create function public.validate_packing_list() returns trigger language plpgsql set search_path='' as $$
declare item jsonb; garment_id text; seen text[] := '{}'; item_ids text[] := '{}'; qty integer; packed integer;
begin
 if new.trip->>'wardrobe_id' is distinct from new.wardrobe_id::text then raise exception 'wardrobe mismatch' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(new.items) loop
  qty := (item->>'quantity')::integer; packed := (item->>'packed')::integer;
  if qty is null or qty not between 1 and 365 or packed is null or packed not between 0 and qty
    or jsonb_typeof(item->'assigned') is distinct from 'array'
    or jsonb_array_length(item->'assigned') > qty or item->>'id' is null or item->>'id'=any(item_ids) then
   raise exception 'invalid packing quantities' using errcode='22023';
  end if;
  item_ids := array_append(item_ids,item->>'id');
  if (select count(*) from jsonb_array_elements_text(item->'assigned')) <>
     (select count(distinct value) from jsonb_array_elements_text(item->'assigned')) then
   raise exception 'duplicate garment' using errcode='22023';
  end if;
  for garment_id in select value from jsonb_array_elements_text(item->'assigned') loop
   if not coalesce((item->>'match_wardrobe')::boolean,false) or
     not exists(select 1 from public.garments g where g.id=garment_id::uuid and g.wardrobe_id=new.wardrobe_id and not g.archived) then
    raise exception 'garment access required' using errcode='42501';
   end if;
   if not new.allow_reuse and garment_id=any(seen) then raise exception 'reuse requires consent' using errcode='22023'; end if;
   seen := array_append(seen,garment_id);
  end loop;
 end loop;
 new.updated_at := now(); return new;
end $$;
create trigger validate_packing_list before insert or update on public.packing_lists
 for each row execute function public.validate_packing_list();
create function private.create_gemini_packing_task_for_user(
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
     or length(coalesce(p_request->>'destination','')) not between 1 and 160
     or coalesce(p_request->>'days','') !~ '^[0-9]{1,3}$'
     or (p_request->>'days')::integer not between 1 and 365
     or coalesce(p_request->>'language','') not in ('en','pl')
     or length(coalesce(p_request->>'notes','')) > 1000
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
   values(p_user_id,'travel_packing',p_request) returning public.gemini_tasks.id into task_id;
  return query select task_id,'queued'::text;
end $$;
revoke all on function private.create_gemini_packing_task_for_user(uuid,jsonb,integer) from public,anon,authenticated,service_role;
grant execute on function private.create_gemini_packing_task_for_user(uuid,jsonb,integer) to wardrobe_session;

notify pgrst,'reload schema';
