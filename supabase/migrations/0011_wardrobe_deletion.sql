-- Durable, narrowly scoped cleanup after an owner-authorized wardrobe deletion.
create table private.wardrobe_deletions (
 wardrobe_id uuid primary key, requested_by uuid not null,
 job_ids uuid[] not null, created_at timestamptz not null default now(),
 available_at timestamptz not null default now()+interval '30 seconds'
);
revoke all on private.wardrobe_deletions from public;
grant select,delete on private.wardrobe_deletions to wardrobe_worker;
grant update(available_at) on private.wardrobe_deletions to wardrobe_worker;
create function public.delete_wardrobe(wardrobe uuid) returns void
language plpgsql security definer set search_path='' as $$
declare ids uuid[];
begin
 perform 1 from public.wardrobes where id=wardrobe and owner_id=auth.uid() for update;
 if not found then raise exception 'Tylko właściciel może usunąć garderobę.' using errcode='42501'; end if;
 perform 1 from public.jobs where wardrobe_id=wardrobe order by id for update;
 select coalesce(array_agg(id),'{}'::uuid[]) into ids from public.jobs where wardrobe_id=wardrobe;
 insert into private.wardrobe_deletions(wardrobe_id,requested_by,job_ids) values(wardrobe,auth.uid(),ids);
 delete from public.wardrobes where id=wardrobe;
end $$;
revoke all on function public.delete_wardrobe(uuid) from public;
grant execute on function public.delete_wardrobe(uuid) to authenticated;
notify pgrst,'reload schema';
