\set ON_ERROR_STOP on
begin;
\ir fixtures/development-users.sql
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ declare w uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); empty_g uuid:=gen_random_uuid(); i uuid:=gen_random_uuid(); second_i uuid:=gen_random_uuid(); p text; r jsonb; begin
 insert into public.wardrobes(id,owner_id,name,kind) values(w,'00000000-0000-4000-8000-000000000001','Rollback AI test','private');
 insert into public.garments(id,wardrobe_id,owner_id,name,category) values(g,w,'00000000-0000-4000-8000-000000000001','Ręczna nazwa','bottoms'),(empty_g,w,'00000000-0000-4000-8000-000000000001','','tops');
 p=w::text||'/'||g::text||'/'||i::text||'.jpg';
 insert into public.garment_images(id,garment_id,wardrobe_id,path,original_path,width,height,rotation,created_at) values(i,g,w,p,p,100,100,90,now()-interval '1 second');
 p=w::text||'/'||g::text||'/'||second_i::text||'.jpg';
 insert into public.garment_images(id,garment_id,wardrobe_id,path,original_path,width,height,rotation) values(second_i,g,w,p,p,100,100,180);
 update public.jobs set status='completed' where wardrobe_id=w;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin perform public.reanalyze_wardrobe(w);raise exception 'Unauthorized analysis accepted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
 r:=public.reanalyze_wardrobe(w);
 if r<> '{"queued":1,"pending":0,"missing":1}'::jsonb then raise exception 'Unexpected counts %',r;end if;
 r:=public.reanalyze_wardrobe(w);
 if r<> '{"queued":0,"pending":1,"missing":1}'::jsonb then raise exception 'Duplicate jobs %',r;end if;
 if (select count(*) from public.jobs where wardrobe_id=w and status='queued')<>1 or not exists(select 1 from public.jobs where image_id=i and type='analyze_garment' and revision=0 and status='queued') then raise exception 'Wrong photo or job type';end if;
 if not exists(select 1 from public.garment_images where id=i and rotation=90 and revision=0) or not exists(select 1 from public.garments where id=g and name='Ręczna nazwa' and category='bottoms') then raise exception 'User data modified';end if;
end $$;
rollback;
\echo PASS owner authorization, one photo per garment, preserved rotation/manual data, no duplicate AI jobs, missing photos, full rollback
