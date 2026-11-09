alter table public.garment_images
 add column original_path text,
 add column original_mime text not null default 'image/webp',
 add column cutout_path text,
 add column catalog_path text,
 add column thumbnail_path text,
 add column revision integer not null default 0,
 add column rotation integer check(rotation in (0,90,180,270)),
 add column process_status text not null default 'queued' check(process_status in ('queued','processing','completed','failed')),
 add column stage text not null default 'Oczekuje na przetwarzanie',
 add column pipeline_version text,
 add column processing_error text,
 add column orientation jsonb,
 add column analysis jsonb;
-- Older uploads only have their normalized WebP; preserve exactly what still exists.
update public.garment_images set original_path=path;
alter table public.garment_images alter column original_path set not null;
alter table public.jobs drop constraint jobs_type_check;
alter table public.jobs add constraint jobs_type_check check(type in ('process_image','analyze_garment','analyze_label'));
alter table public.jobs add column revision integer not null default 0,
 add column available_at timestamptz not null default now();
create index jobs_ready on public.jobs(status,available_at);
grant update on public.garment_images to wardrobe_worker;
create policy worker_images_update on public.garment_images for update to wardrobe_worker using(true) with check(true);
revoke update(path,width,height) on public.garment_images from authenticated;
grant insert(original_path,original_mime) on public.garment_images to authenticated;
create function public.enqueue_image() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.jobs(wardrobe_id,garment_id,image_id,type,revision,requested_by) values
 (new.wardrobe_id,new.garment_id,new.id,case when new.kind='label' then 'analyze_label' else 'process_image' end,new.revision,auth.uid());
 if new.kind='garment' then insert into public.jobs(wardrobe_id,garment_id,image_id,type,revision,requested_by)
 values(new.wardrobe_id,new.garment_id,new.id,'analyze_garment',new.revision,auth.uid()); end if;
 return new; end $$;
create trigger image_uploaded after insert on public.garment_images for each row execute function public.enqueue_image();
create function public.reprocess_image(image uuid,angle integer default null) returns jsonb language plpgsql security definer set search_path='' as $$ declare i public.garment_images; begin
 select * into i from public.garment_images where id=image for update;
 if i.id is null or not public.has_wardrobe_access(i.wardrobe_id,true) then raise exception 'forbidden'; end if;
 if angle is not null and angle not in (0,90,180,270) then raise exception 'invalid rotation'; end if;
 update public.garment_images set revision=revision+1,rotation=coalesce(angle,rotation),process_status='queued',stage='Oczekuje na przetwarzanie',processing_error=null where id=image returning * into i;
 insert into public.jobs(wardrobe_id,garment_id,image_id,type,revision,requested_by) values(i.wardrobe_id,i.garment_id,i.id,case when i.kind='label' then 'analyze_label' else 'process_image' end,i.revision,auth.uid());
 if i.kind='garment' then insert into public.jobs(wardrobe_id,garment_id,image_id,type,revision,requested_by) values(i.wardrobe_id,i.garment_id,i.id,'analyze_garment',i.revision,auth.uid()); end if;
 return to_jsonb(i); end $$;
revoke all on function public.enqueue_image(),public.reprocess_image(uuid,integer) from public;
grant execute on function public.reprocess_image(uuid,integer) to authenticated;
create or replace function public.retry_job(job_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$ declare j public.jobs; begin
 select * into j from public.jobs where id=job_id for update;
 if j.id is null or not public.has_wardrobe_access(j.wardrobe_id,true) then raise exception 'forbidden'; end if;
 if j.status<>'failed' then raise exception 'only failed jobs can be retried'; end if;
 update public.jobs set status='queued',attempts=0,error=null,progress=0,available_at=now(),requested_by=auth.uid() where id=job_id returning * into j;
 update public.garment_images set process_status='queued',stage='Oczekuje na przetwarzanie',processing_error=null where id=j.image_id and revision=j.revision and j.type='process_image';
 return to_jsonb(j); end $$;
notify pgrst,'reload schema';
