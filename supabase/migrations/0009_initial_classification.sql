-- Narrow worker operation; no general metadata UPDATE privileges.
create function private.apply_initial_classification(job_id uuid, suggestions jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare j public.jobs; g public.garments;
begin
 select * into j from public.jobs where id=job_id and type='analyze_garment' and status='processing';
 if not found then return false; end if;
 if not exists(select 1 from public.wardrobe_members where wardrobe_id=j.wardrobe_id and user_id=j.requested_by and role in ('owner','editor')) then return false; end if;
 select * into g from public.garments where id=j.garment_id and wardrobe_id=j.wardrobe_id for update;
 if not found or g.updated_at<>g.created_at then return false; end if;
 if not exists(select 1 from public.garment_images where id=j.image_id and garment_id=g.id and revision=j.revision and kind='garment') then return false; end if;
 if exists(select 1 from public.garment_images where garment_id=g.id and analysis is not null) then return false; end if;
 if suggestions->>'category' not in ('tops','bottoms','dresses','outerwear','shoes','accessories') or suggestions->>'category' is null then return false; end if;
 update public.garments set
 category=case when g.category='tops' and g.subcategory='' then suggestions->>'category' else g.category end,
 subcategory=case when g.subcategory='' then coalesce(suggestions->>'subcategory','') else g.subcategory end,
 primary_color=case when g.primary_color='' then coalesce(suggestions->>'primary_color','') else g.primary_color end,
 secondary_color=case when g.secondary_color='' then coalesce(suggestions->>'secondary_color','') else g.secondary_color end,
 name=case when g.name_source='temporary' then coalesce(nullif(suggestions->>'name',''),g.name) else g.name end,
 name_source=case when g.name_source='temporary' and nullif(suggestions->>'name','') is not null then 'ai' else g.name_source end
 where id=g.id;
 return true;
end $$;
revoke all on function private.apply_initial_classification(uuid,jsonb) from public;
grant execute on function private.apply_initial_classification(uuid,jsonb) to wardrobe_worker;
