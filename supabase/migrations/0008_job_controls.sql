-- Preserve all job history; cancellation is a terminal business state.
alter table public.jobs drop constraint jobs_status_check;
alter table public.jobs add constraint jobs_status_check check(status in ('queued','processing','completed','failed','cancelled'));
alter table public.garment_images drop constraint garment_images_process_status_check;
alter table public.garment_images add constraint garment_images_process_status_check check(process_status in ('queued','processing','completed','failed','cancelled'));

-- Internal BFF role only. The BFF checks its administrator UUID allowlist first.
create function private.cancel_queue_jobs(queue_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cancelled jsonb;
begin
 if queue_kind not in ('all','images','ai') then raise exception 'invalid queue'; end if;
 with changed as (
  update public.jobs set status='cancelled',error='Anulowano przez administratora.'
  where status in ('queued','processing') and
   (queue_kind='all' or (queue_kind='images' and type='process_image') or (queue_kind='ai' and type<>'process_image'))
  returning id,type,image_id,revision
 ), marked as (
  update public.garment_images i set process_status='cancelled',stage='Anulowano',processing_error=null
  where exists(select 1 from changed j where j.image_id=i.id and j.revision=i.revision and (j.type='process_image' or i.kind='label'))
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'type',type)),'[]'::jsonb) into cancelled from changed;
 return cancelled;
end $$;
revoke all on function private.cancel_queue_jobs(text) from public;
grant execute on function private.cancel_queue_jobs(text) to wardrobe_session;

-- Analysis only: does not rerun ONNX, change image revision or erase old suggestions.
create function public.reanalyze_image(image uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.garment_images; j public.jobs;
begin
 select * into i from public.garment_images where id=image for update;
 if i.id is null or not public.has_wardrobe_access(i.wardrobe_id,true) then raise exception 'forbidden' using errcode='42501'; end if;
 select * into j from public.jobs where image_id=i.id and revision=i.revision and type in ('analyze_garment','analyze_label') and status in ('queued','processing') order by created_at desc limit 1;
 if j.id is null then
  insert into public.jobs(wardrobe_id,garment_id,image_id,type,revision,requested_by)
  values(i.wardrobe_id,i.garment_id,i.id,case when i.kind='label' then 'analyze_label' else 'analyze_garment' end,i.revision,auth.uid()) returning * into j;
 end if;
 return to_jsonb(j);
end $$;
revoke all on function public.reanalyze_image(uuid) from public;
grant execute on function public.reanalyze_image(uuid) to authenticated;
notify pgrst,'reload schema';
