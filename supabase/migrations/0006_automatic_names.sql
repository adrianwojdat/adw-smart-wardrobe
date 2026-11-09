-- Existing names remain untouched and are treated as manual, including legacy duplicates.
alter table public.garments add column name_source text not null default 'manual'
 check(name_source in ('temporary','ai','manual'));
create index garments_owner_name_lookup on public.garments(owner_id,lower(name));
create function public.assign_garment_name() returns trigger language plpgsql security definer set search_path='' as $$
declare base text; candidate text; suffix integer := 0; automatic boolean;
begin
 -- Serialize name allocation across every wardrobe belonging to the same user.
 perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text,90421));
 if tg_op='UPDATE' and new.name=old.name and new.name_source=old.name_source then return new; end if;
 if tg_op='INSERT' and (new.name is null or btrim(new.name)='') then
  new.name_source='temporary'; base='Ubranie '||new.id::text;
 elsif tg_op='UPDATE' and session_user='wardrobe_worker' then
  if old.name_source<>'temporary' or new.name_source<>'ai' then raise exception 'automatic naming requires temporary name'; end if;
  base=btrim(new.name);
 else
  new.name_source='manual'; base=btrim(new.name);
 end if;
 if base is null or length(base)=0 or length(base)>120 then raise exception 'invalid garment name' using errcode='23514'; end if;
 automatic=new.name_source in ('temporary','ai'); candidate=base;
 while exists(select 1 from public.garments where owner_id=new.owner_id and lower(name)=lower(candidate) and id<>new.id) loop
  if not automatic then raise exception 'Ta nazwa ubrania jest już używana.' using errcode='23505'; end if;
  suffix=suffix+1;candidate=left(base,110)||' '||suffix::text;
 end loop;
 new.name=candidate;return new;
end $$;
create trigger assign_garment_name before insert or update of name,name_source on public.garments
 for each row execute function public.assign_garment_name();
revoke all on function public.assign_garment_name() from public;
grant update(name_source) on public.garments to authenticated;
-- Worker can name only still-temporary rows. All other metadata stays user-controlled.
grant update(name,name_source) on public.garments to wardrobe_worker;
create policy worker_name_update on public.garments for update to wardrobe_worker
 using(name_source='temporary') with check(name_source='ai');
notify pgrst,'reload schema';
