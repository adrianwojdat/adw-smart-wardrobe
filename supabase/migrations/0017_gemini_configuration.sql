-- Gemini credentials are encrypted by the BFF and never returned to clients.
create table public.gemini_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_key text not null check (encrypted_key ~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'),
  key_hint text not null check (length(key_hint) = 4),
  model text check (model is null or model ~ '^models/[A-Za-z0-9._-]{1,120}$'),
  updated_at timestamptz not null default now()
);
alter table public.gemini_credentials enable row level security;
create policy gemini_credentials_owner on public.gemini_credentials
  for select to authenticated using (user_id = auth.uid());
create policy gemini_credentials_owner_insert on public.gemini_credentials
  for insert to authenticated with check (user_id = auth.uid());
create policy gemini_credentials_owner_update on public.gemini_credentials
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy gemini_credentials_owner_delete on public.gemini_credentials
  for delete to authenticated using (user_id = auth.uid());
create policy gemini_credentials_worker on public.gemini_credentials
  for select to wardrobe_worker using (true);
grant select(user_id, key_hint, model, updated_at) on public.gemini_credentials to authenticated;
grant insert(user_id, encrypted_key, key_hint, model), update(user_id, encrypted_key, key_hint, model), delete on public.gemini_credentials to authenticated;
grant select(user_id, encrypted_key, key_hint, model, updated_at) on public.gemini_credentials to wardrobe_worker;

create table public.gemini_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('connection_test','list_models')),
  status text not null default 'queued' check (status in ('queued','running','retrying','completed','failed','cancelled')),
  result jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index gemini_tasks_owner_recent on public.gemini_tasks(user_id, created_at desc);
create index gemini_tasks_dispatch on public.gemini_tasks(status, created_at) where status in ('queued','retrying');
create trigger gemini_credentials_updated before update on public.gemini_credentials
  for each row execute function public.touch_updated_at();
create trigger gemini_tasks_updated before update on public.gemini_tasks
  for each row execute function public.touch_updated_at();
create unique index gemini_tasks_one_active_per_user on public.gemini_tasks(user_id)
  where status in ('queued','running','retrying');
alter table public.gemini_tasks enable row level security;
create policy gemini_tasks_owner_read on public.gemini_tasks
  for select to authenticated using (user_id = auth.uid());
create policy gemini_tasks_worker_read on public.gemini_tasks
  for select to wardrobe_worker using (true);
create policy gemini_tasks_worker_update on public.gemini_tasks
  for update to wardrobe_worker using (true) with check (true);
grant select on public.gemini_tasks to authenticated;
grant select, update on public.gemini_tasks to wardrobe_worker;

create function private.create_gemini_task_for_user(p_user_id uuid, p_kind text, p_queue_limit integer)
returns table(id uuid, status text)
language plpgsql security definer set search_path = '' as $$
declare task_id uuid;
begin
  if session_user <> 'wardrobe_session' then raise exception 'BFF role required' using errcode = '42501'; end if;
  if p_user_id is null or not exists (select 1 from auth.users u where u.id=p_user_id) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  if p_kind not in ('connection_test','list_models') or p_queue_limit not between 1 and 1000 then
    raise exception 'invalid task options' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(173450002);
  select t.id into task_id from public.gemini_tasks t
    where t.user_id = p_user_id and t.status in ('queued','running','retrying') limit 1;
  if task_id is not null then
    return query select task_id, 'existing'::text;
    return;
  end if;
  if (select count(*) from public.gemini_tasks t where t.status in ('queued','running','retrying')) >= p_queue_limit then
    raise exception 'queue is full' using errcode = '53000';
  end if;
  insert into public.gemini_tasks(user_id, kind) values (p_user_id, p_kind) returning public.gemini_tasks.id into task_id;
  return query select task_id, 'queued'::text;
end $$;
revoke all on function private.create_gemini_task_for_user(uuid, text, integer) from public, anon, authenticated, service_role;
grant execute on function private.create_gemini_task_for_user(uuid, text, integer) to wardrobe_session;

create function private.cancel_gemini_task_for_user(p_user_id uuid, p_task_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare task_status text;
begin
  if session_user <> 'wardrobe_session' then raise exception 'BFF role required' using errcode = '42501'; end if;
  update public.gemini_tasks t set status = 'cancelled', error_code = 'cancelled',
      error_message = 'Zadanie anulowano.', updated_at = now(), completed_at = now()
    where t.id = p_task_id and t.user_id = p_user_id
      and t.status in ('queued','running','retrying')
    returning t.status into task_status;
  if task_status is null then
    select t.status into task_status from public.gemini_tasks t where t.id = p_task_id and t.user_id = p_user_id;
  end if;
  if task_status is null then raise exception 'task not found' using errcode = 'P0002'; end if;
  return task_status;
end $$;
revoke all on function private.cancel_gemini_task_for_user(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function private.cancel_gemini_task_for_user(uuid, uuid) to wardrobe_session;
notify pgrst, 'reload schema';
