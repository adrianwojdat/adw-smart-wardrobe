create function public.retry_job(job_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$ declare j public.jobs; begin
 select * into j from public.jobs where id=job_id for update;
 if j.id is null or not public.has_wardrobe_access(j.wardrobe_id,true) then raise exception 'forbidden'; end if;
 if j.status<>'failed' then raise exception 'only failed jobs can be retried'; end if;
 update public.jobs set status='queued',attempts=0,error=null,progress=0 where id=job_id returning * into j;
 return to_jsonb(j); end $$;
create function public.save_outfit(payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$ declare o public.outfits; gid uuid; w uuid; begin
 w=(payload->>'wardrobe_id')::uuid;
 if not public.has_wardrobe_access(w,true) then raise exception 'forbidden'; end if;
 insert into public.outfits(wardrobe_id,name,occasion,temperature) values(w,payload->>'name',payload->>'occasion',(payload->>'temperature')::numeric) returning * into o;
 for gid in select jsonb_array_elements_text(payload->'garment_ids')::uuid loop
 insert into public.outfit_garments(outfit_id,garment_id,wardrobe_id) values(o.id,gid,w);
 end loop;
 return to_jsonb(o)||jsonb_build_object('garment_ids',payload->'garment_ids'); end $$;
create function public.record_wear(garment uuid,day date) returns jsonb language plpgsql security invoker set search_path='' as $$ declare g public.garments; begin
 if day>current_date or day<current_date-3650 then raise exception 'invalid day'; end if;
 select * into g from public.garments where id=garment for update;
 if g.id is null or not public.has_wardrobe_access(g.wardrobe_id,true) then raise exception 'forbidden'; end if;
 insert into public.wear_history(wardrobe_id,garment_id,worn_on) values(g.wardrobe_id,g.id,day) on conflict do nothing;
 update public.garments set cleanliness='worn' where id=garment;
 return jsonb_build_object('ok',true); end $$;
revoke all on function public.retry_job(uuid),public.save_outfit(jsonb),public.record_wear(uuid,date) from public;
grant execute on function public.retry_job(uuid),public.save_outfit(jsonb),public.record_wear(uuid,date) to authenticated;
notify pgrst,'reload schema';
