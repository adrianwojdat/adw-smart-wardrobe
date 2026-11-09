-- Queue one garment photo per garment, using the persisted rotation/revision.
create function public.reanalyze_wardrobe(wardrobe uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.garment_images; queued integer:=0; pending integer:=0; missing integer;
begin
 perform 1 from public.wardrobes where id=wardrobe and owner_id=auth.uid() for update;
 if not found then raise exception 'Tylko właściciel może zlecić analizę całej garderoby.' using errcode='42501'; end if;
 select count(*) into missing from public.garments g where g.wardrobe_id=wardrobe and not exists(select 1 from public.garment_images p where p.garment_id=g.id and p.kind='garment');
 for i in select p.* from public.garment_images p
 where p.wardrobe_id=wardrobe and p.kind='garment' and p.id=(select first.id from public.garment_images first where first.garment_id=p.garment_id and first.kind='garment' order by first.created_at,first.id limit 1)
 order by p.id for update loop
  if exists(select 1 from public.jobs where image_id=i.id and revision=i.revision and type='analyze_garment' and status in ('queued','processing')) then
   pending:=pending+1;
  else
   insert into public.jobs(wardrobe_id,garment_id,image_id,type,revision,requested_by)
   values(wardrobe,i.garment_id,i.id,'analyze_garment',i.revision,auth.uid());
   queued:=queued+1;
  end if;
 end loop;
 return jsonb_build_object('queued',queued,'pending',pending,'missing',missing);
end $$;
revoke all on function public.reanalyze_wardrobe(uuid) from public;
grant execute on function public.reanalyze_wardrobe(uuid) to authenticated;
notify pgrst,'reload schema';
