-- Regression against the actual installed schema. Everything rolls back;
-- no Storage objects or durable jobs are created. Requires an existing wardrobe.
\set ON_ERROR_STOP on
begin;
\ir fixtures/development-users.sql
insert into public.wardrobes(owner_id,name) values('00000000-0000-4000-8000-000000000001','Isolated bulk test') returning id as wardrobe, owner_id as owner, gen_random_uuid() as garment, gen_random_uuid() as image \gset
set local role authenticated;
select set_config('request.jwt.claim.sub', :'owner', true), set_config('test.wardrobe', :'wardrobe', true) \gset
insert into public.garments(id,wardrobe_id,category) values(:'garment',:'wardrobe','tops');
select name='Ubranie '||id::text and name_source='temporary' as temporary_name_correct from public.garments where id=:'garment';
insert into public.garment_images(id,garment_id,wardrobe_id,path,original_path,original_mime,kind,width,height)
values(:'image',:'garment',:'wardrobe',:'wardrobe'||'/'||:'garment'||'/'||:'image'||'.original',:'wardrobe'||'/'||:'garment'||'/'||:'image'||'.original','image/jpeg','garment',10,10);
select count(*)=2 as two_jobs_queued from public.jobs where image_id=:'image';
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true) \gset
do $$ begin
 begin
  insert into public.garments(id,wardrobe_id,category) values(gen_random_uuid(),current_setting('test.wardrobe')::uuid,'tops');
  raise exception 'FAIL: RLS allowed another user';
 exception when insufficient_privilege then
  raise notice 'PASS: RLS denies unrelated user';
 end;
end $$;
rollback;
