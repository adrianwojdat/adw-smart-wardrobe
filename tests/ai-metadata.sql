\set ON_ERROR_STOP on
begin;
\ir fixtures/development-users.sql
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare n integer;begin
 if (select ai_overwrite_metadata from public.profiles where id=auth.uid()) then raise exception 'Preference must default off';end if;
 update public.profiles set ai_overwrite_metadata=true where id=auth.uid();
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
 if exists(select 1 from public.profiles where id='00000000-0000-4000-8000-000000000001') then raise exception 'Profile RLS leaked another user';end if;
 update public.profiles set ai_overwrite_metadata=false where id='00000000-0000-4000-8000-000000000001';
 get diagnostics n=row_count;if n<>0 then raise exception 'Changed another profile';end if;
 if (select ai_overwrite_metadata from public.profiles where id=auth.uid()) then raise exception 'Other preference changed';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ declare w uuid:=gen_random_uuid();g uuid:=gen_random_uuid();i uuid:=gen_random_uuid();j uuid;version timestamptz;applied boolean;p text;begin
 if has_function_privilege('authenticated','private.apply_ai_metadata(uuid,jsonb,timestamptz)','execute') then raise exception 'Privileged function exposed';end if;
 insert into public.wardrobes(id,owner_id,name) values(w,auth.uid(),'Isolated AI metadata test');
 insert into public.garments(id,wardrobe_id,owner_id,name,category,primary_color,pattern,notes,material,size,warmth,warmth_manual,created_at,updated_at)
 values(g,w,auth.uid(),'Moja ręczna nazwa','tops','biały','gładki','Ręczne notatki','Materiał użytkownika','L',5,true,'2026-01-01','2026-01-01');
 p=w::text||'/'||g::text||'/'||i::text||'.jpg';
 insert into public.garment_images(id,garment_id,wardrobe_id,path,original_path,width,height) values(i,g,w,p,p,100,100);
 update public.jobs set status='processing' where image_id=i and type='analyze_garment' returning id into j;
 select updated_at into version from public.garments where id=g;
 applied:=private.apply_ai_metadata(j,'{"category":"bottoms","subcategory":"Chinosy","primary_color":"granatowy","pattern":"paski","warmth":2,"name":"Nie wolno","notes":"Nie wolno","owner_id":"00000000-0000-4000-8000-000000000002","size":"XL","material":"Nie wolno"}',version);
 if not applied or not exists(select 1 from public.garments where id=g and category='bottoms' and subcategory='Chinosy' and primary_color='granatowy' and pattern='paski' and warmth=2 and not warmth_manual and name='Moja ręczna nazwa' and notes='Ręczne notatki' and owner_id=auth.uid() and wardrobe_id=w and material='Materiał użytkownika' and size='L') then raise exception 'Enabled metadata or protected fields failed';end if;
 select updated_at into version from public.garments where id=g;
 applied:=private.apply_ai_metadata(j,'{"category":"unknown","primary_color":"","secondary_color":null,"pattern":"unknown","style":"none","seasons":[],"occasions":["invalid"],"warmth":null}',version);
 if applied then raise exception 'Empty/unknown metadata accepted';end if;
 if not exists(select 1 from public.garments where id=g and primary_color='granatowy' and pattern='paski' and warmth=2) then raise exception 'Valid values erased';end if;
 update public.garments set notes='Zmiana podczas analizy' where id=g;
 applied:=private.apply_ai_metadata(j,'{"category":"dresses","primary_color":"czarny"}',version-interval '1 microsecond');
 if applied or not exists(select 1 from public.garments where id=g and category='bottoms' and notes='Zmiana podczas analizy') then raise exception 'Stale analysis overwrote manual change';end if;
 update public.jobs set requested_by='00000000-0000-4000-8000-000000000002' where id=j;
 select updated_at into version from public.garments where id=g;
 if private.apply_ai_metadata(j,'{"category":"dresses"}',version) then raise exception 'Other requester overwrote garment';end if;
 update public.jobs set requested_by=auth.uid() where id=j;
 update public.profiles set ai_overwrite_metadata=false where id=auth.uid();
 if private.apply_ai_metadata(j,'{"category":"dresses"}',version) then raise exception 'Disabled preference still applied';end if;
 if not exists(select 1 from public.garment_images where id=i and original_path=p and revision=0) then raise exception 'Image reference modified';end if;
end $$;
rollback;
\echo PASS default-off, per-user RLS, enabled metadata, protected fields, unknown/empty values, full-precision conflicts, requester scope, disabled setting, image preservation; full rollback
