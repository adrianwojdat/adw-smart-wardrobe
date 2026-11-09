\set ON_ERROR_STOP on
begin;
\ir fixtures/development-users.sql
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ declare w uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); i uuid:=gen_random_uuid(); p text; begin
 insert into public.wardrobes(id,owner_id,name,kind) values(w,'00000000-0000-4000-8000-000000000001','Rollback deletion test','private');
 insert into public.garments(id,wardrobe_id,owner_id,name,category) values(g,w,'00000000-0000-4000-8000-000000000001','','tops');
 p=w::text||'/'||g::text||'/'||i::text||'.jpg';
 insert into public.garment_images(id,garment_id,wardrobe_id,path,original_path,width,height) values(i,g,w,p,p,100,100);
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 begin
  perform public.delete_wardrobe(w);
  raise exception 'Unauthorized deletion accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
 perform public.delete_wardrobe(w);
 if exists(select 1 from public.garments where id=g) or exists(select 1 from public.jobs where image_id=i) then raise exception 'Cascade failed'; end if;
 if not exists(select 1 from private.wardrobe_deletions where wardrobe_id=w and cardinality(job_ids)=2) then raise exception 'Missing durable cleanup'; end if;
 if not exists(select 1 from auth.users where id='00000000-0000-4000-8000-000000000001') then raise exception 'Account removed'; end if;
end $$;
rollback;
\echo PASS ownership, cascade, durable cleanup, preserved account; no persistent changes
