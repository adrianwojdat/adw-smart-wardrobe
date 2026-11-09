\set ON_ERROR_STOP on
begin;
\ir ../supabase/migrations/0013_category_warmth.sql
\ir fixtures/development-users.sql
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ declare w uuid:=gen_random_uuid(); g uuid; i uuid; j uuid; manual boolean; heat integer; p text; begin
 insert into public.wardrobes(id,owner_id,name) values(w,'00000000-0000-4000-8000-000000000001','Warmth test');
 foreach manual in array array[false,true] loop
  g:=gen_random_uuid();i:=gen_random_uuid();p:=w::text||'/'||g::text||'/'||i::text||'.jpg';
  insert into public.garments(id,wardrobe_id,owner_id,name,category,warmth,warmth_manual,created_at,updated_at) values(g,w,'00000000-0000-4000-8000-000000000001','Test '||g::text,'tops',case when manual then 5 else 3 end,manual,now()-interval '1 second',now()-interval '1 second');
  insert into public.garment_images(id,garment_id,wardrobe_id,path,original_path,width,height) values(i,g,w,p,p,100,100);
  update public.jobs set status='processing' where image_id=i and type='analyze_garment' returning id into j;
  if not private.apply_initial_classification(j,'{"category":"bottoms","subcategory":"Spodnie","warmth":2}') then raise exception 'Initial classification refused';end if;
  select warmth into heat from public.garments where id=g;
  if heat<>(case when manual then 5 else 2 end) then raise exception 'Manual priority or derived warmth failed';end if;
 end loop;
end $$;
rollback;
\echo PASS derived warmth persisted, manual warmth preserved, no persistent changes
