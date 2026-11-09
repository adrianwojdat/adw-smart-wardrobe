\set ON_ERROR_STOP on
begin;
\ir fixtures/development-users.sql
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
create temporary table fixture(g uuid,i uuid,j uuid);
do $$ declare w uuid; g uuid:=gen_random_uuid(); i uuid:=gen_random_uuid(); j uuid; p text; begin
 insert into public.wardrobes(owner_id,name) values('00000000-0000-4000-8000-000000000001','Isolated test') returning id into w;
 insert into public.garments(id,wardrobe_id,owner_id,name,category,created_at,updated_at) values(g,w,'00000000-0000-4000-8000-000000000001','Nazwa ręczna','tops',now()-interval '1 second',now()-interval '1 second');
 p=w::text||'/'||g::text||'/'||i::text||'.jpg';
 insert into public.garment_images(id,garment_id,wardrobe_id,path,original_path,width,height) values(i,g,w,p,p,100,100);
 update public.jobs set status='processing' where image_id=i and type='analyze_garment' returning id into j;
 insert into fixture values(g,i,j);
end $$;
grant select on fixture to wardrobe_worker;

do $$ declare f record; applied boolean; begin
 select * into f from fixture;
 select private.apply_initial_classification(f.j,'{"name":"Białe spodnie","category":"bottoms","subcategory":"Spodnie","primary_color":"biały"}') into applied;
 if not applied or not exists(select 1 from public.garments where id=f.g and category='bottoms' and name='Nazwa ręczna') then raise exception 'Initial classification failed'; end if;
 select private.apply_initial_classification(f.j,'{"category":"dresses"}') into applied;
 if applied then raise exception 'Repeated classification overwrote garment'; end if;
end $$;

-- Simulate an intervening manual edit and a manually chosen name.
update public.garments set name='Moja nazwa',name_source='manual',category='outerwear' where id=(select g from fixture);

do $$ declare applied boolean; begin
 select private.apply_initial_classification(j,'{"name":"Zmiana","category":"dresses"}') into applied from fixture;
 if applied or not exists(select 1 from public.garments where id=(select g from fixture) and name='Moja nazwa' and category='outerwear') then raise exception 'Manual changes overwritten'; end if;
end $$;

rollback;
\echo PASS initial metadata, repeat protection, manual edit protection; all fixtures rolled back
